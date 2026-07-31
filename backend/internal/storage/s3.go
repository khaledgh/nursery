package storage

import (
	"context"
	"fmt"
	"io"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type S3Storage struct {
	client   *s3.Client
	presign  *s3.PresignClient
	bucket   string
	endpoint string
	region   string
	baseURL  string
	signer   *Signer
	// readTTL controls how long a presigned GET returned from URL() stays
	// valid before urlCache regenerates it.
	readTTL time.Duration

	// urlCache holds presigned GET URLs keyed by object key. A SigV4 URL
	// embeds the exact signing timestamp, so re-presigning on every read (the
	// AfterFind hook calls URL() on every row load) would hand expo-image a
	// new URI for the same photo each time, defeating its URI-keyed cache.
	// Caching for most of readTTL keeps repeated reads of the same media
	// stable without serving a URL past its real expiry.
	urlCache sync.Map // key -> cachedURL
}

type cachedURL struct {
	url       string
	expiresAt time.Time
}

type S3Options struct {
	Bucket    string
	Region    string
	AccessKey string
	SecretKey string
	Endpoint  string // optional, for S3-compatible providers (MinIO, R2, ...)
	// PathStyle addresses the bucket as <endpoint>/<bucket>/<key>. Required by
	// MinIO and by R2's S3 endpoint; leave off for virtual-host-style providers.
	PathStyle bool
	// BaseURL and Signer are kept for drivers/tests that still need the API
	// stream URL shape; ReadTTL controls the presigned GET returned by URL().
	BaseURL string
	Signer  *Signer
	// ReadTTL is how long a presigned read URL stays valid. Defaults to 24h
	// when zero, matching the historical MEDIA_URL_TTL default.
	ReadTTL time.Duration
}

func NewS3Storage(ctx context.Context, opts S3Options) (*S3Storage, error) {
	loadOpts := []func(*awsconfig.LoadOptions) error{
		awsconfig.WithRegion(opts.Region),
	}
	if opts.AccessKey != "" {
		loadOpts = append(loadOpts, awsconfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(opts.AccessKey, opts.SecretKey, "")))
	}
	cfg, err := awsconfig.LoadDefaultConfig(ctx, loadOpts...)
	if err != nil {
		return nil, fmt.Errorf("storage: s3 config: %w", err)
	}
	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		if opts.Endpoint != "" {
			o.BaseEndpoint = aws.String(opts.Endpoint)
			o.UsePathStyle = opts.PathStyle
		}
	})
	readTTL := opts.ReadTTL
	if readTTL <= 0 {
		readTTL = 24 * time.Hour
	}
	return &S3Storage{
		client:   client,
		presign:  s3.NewPresignClient(client),
		bucket:   opts.Bucket,
		endpoint: opts.Endpoint,
		region:   opts.Region,
		baseURL:  opts.BaseURL,
		signer:   opts.Signer,
		readTTL:  readTTL,
	}, nil
}

func (s *S3Storage) Put(ctx context.Context, key string, r io.Reader, mime string, size int64) (*StoredFile, error) {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(s.bucket),
		Key:           aws.String(key),
		Body:          r,
		ContentType:   aws.String(mime),
		ContentLength: aws.Int64(size),
	})
	if err != nil {
		return nil, fmt.Errorf("storage: s3 put: %w", err)
	}
	return &StoredFile{Disk: "s3", Path: key, URL: s.URL(key), Size: size}, nil
}

func (s *S3Storage) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	return err
}

func (s *S3Storage) Open(ctx context.Context, key string) (io.ReadCloser, error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, err
	}
	return out.Body, nil
}

// Head reports what R2 actually recorded for a client's direct PUT — the
// server never saw those bytes, so this HeadObject call is the only place
// the upload gets checked against the declared mime/size before the row is
// trusted as "ready".
func (s *S3Storage) Head(ctx context.Context, key string) (*ObjectInfo, error) {
	out, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, err
	}
	info := &ObjectInfo{Size: aws.ToInt64(out.ContentLength)}
	if out.ContentType != nil {
		info.Mime = *out.ContentType
	}
	return info, nil
}

// NewS3StorageForTest builds a driver with no live client, for tests that only
// exercise the legacy stream-URL fallback. Constructing a real client would
// drag in AWS credential and region discovery, which does network I/O.
func NewS3StorageForTest(bucket, endpoint, region, baseURL string, signer *Signer) *S3Storage {
	return &S3Storage{bucket: bucket, endpoint: endpoint, region: region, baseURL: baseURL, signer: signer, readTTL: 24 * time.Hour}
}

// NewS3StorageWithPresignForTest builds a driver whose presign client is
// wired up with static, non-network credentials — SigV4 presigning is pure
// local computation, so this exercises the real PresignPut/PresignGet code
// paths without ever making a request.
func NewS3StorageWithPresignForTest(bucket, endpoint, region string, readTTL time.Duration) *S3Storage {
	client := s3.New(s3.Options{
		Region:       region,
		Credentials:  credentials.NewStaticCredentialsProvider("test-access-key", "test-secret-key", ""),
		BaseEndpoint: aws.String(endpoint),
		UsePathStyle: true,
	})
	if readTTL <= 0 {
		readTTL = 24 * time.Hour
	}
	return &S3Storage{
		client:  client,
		presign: s3.NewPresignClient(client),
		bucket:  bucket,
		region:  region,
		readTTL: readTTL,
	}
}

// URL returns a presigned, time-limited GET URL for key, NOT a bare object URL.
//
// Returning an unsigned object URL here would publish every child photo and
// medical document to anyone holding the link, because the bucket is private
// and unauthenticated readers would simply get a 403 instead. A presigned URL
// keeps the bucket private while letting the client fetch bytes directly from
// R2 instead of proxying them through the API.
func (s *S3Storage) URL(key string) string {
	if s.presign == nil {
		// Test/zero-value construction with no live client: fall back to the
		// legacy signed stream shape so existing shape-checking tests still work.
		return StreamURL(s.baseURL, key, s.signer)
	}
	if v, ok := s.urlCache.Load(key); ok {
		c := v.(cachedURL)
		if time.Now().Before(c.expiresAt) {
			return c.url
		}
	}
	url, err := s.PresignGet(context.Background(), key, s.readTTL)
	if err != nil {
		return ""
	}
	// Refresh at 80% of the TTL so a cached URL is never handed out close to
	// its real expiry (a client could still be mid-request when it lapses).
	s.urlCache.Store(key, cachedURL{url: url, expiresAt: time.Now().Add(s.readTTL * 4 / 5)})
	return url
}

func (s *S3Storage) Driver() string { return "s3" }

// PresignPut returns a URL the client can PUT the object body to directly.
// The key is always server-generated (see MediaService.Upload / PresignUpload)
// so a forged key here still lands under a path the caller does not control
// the shape of; content-type/size are bound into the signature so the object
// that lands cannot silently be a different type or larger than declared.
func (s *S3Storage) PresignPut(ctx context.Context, key, mime string, size int64, ttl time.Duration) (string, error) {
	req, err := s.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(s.bucket),
		Key:           aws.String(key),
		ContentType:   aws.String(mime),
		ContentLength: aws.Int64(size),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", fmt.Errorf("storage: s3 presign put: %w", err)
	}
	return req.URL, nil
}

// PresignGet returns a fresh time-limited URL the client can read the object
// from directly — every call re-signs against the current time, so callers
// that need a stable URL across repeated reads of the same key should go
// through URL(), which caches. Exposed separately for the presign-upload
// confirmation step, which always wants a fresh signature.
func (s *S3Storage) PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error) {
	req, err := s.presign.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", fmt.Errorf("storage: s3 presign get: %w", err)
	}
	return req.URL, nil
}
