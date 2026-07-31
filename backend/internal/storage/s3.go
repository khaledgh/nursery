package storage

import (
	"context"
	"fmt"
	"io"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type S3Storage struct {
	client   *s3.Client
	bucket   string
	endpoint string
	region   string
	baseURL  string
	signer   *Signer
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
	// BaseURL and Signer build the API stream URL objects are served through.
	// The bucket itself stays private, so these are what make media reachable.
	BaseURL string
	Signer  *Signer
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
	return &S3Storage{
		client:   client,
		bucket:   opts.Bucket,
		endpoint: opts.Endpoint,
		region:   opts.Region,
		baseURL:  opts.BaseURL,
		signer:   opts.Signer,
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

// NewS3StorageForTest builds a driver with no live client, for tests that only
// exercise URL construction. Constructing a real client would drag in AWS
// credential and region discovery, which does network I/O.
func NewS3StorageForTest(bucket, endpoint, region, baseURL string, signer *Signer) *S3Storage {
	return &S3Storage{bucket: bucket, endpoint: endpoint, region: region, baseURL: baseURL, signer: signer}
}

// URL returns the signed API stream URL, NOT a bucket URL.
//
// Returning a direct object URL here would publish every child photo and
// medical document to anyone holding the link, because the bucket is private
// and unauthenticated readers would simply get a 403 instead. Serving through
// the API keeps one access check in front of all media regardless of driver.
func (s *S3Storage) URL(key string) string {
	return StreamURL(s.baseURL, key, s.signer)
}

func (s *S3Storage) Driver() string { return "s3" }
