package service

import (
	"bytes"
	"context"
	"encoding/binary"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"io"
	"strings"

	xdraw "golang.org/x/image/draw"

	"github.com/sunnystars/backend/internal/database"
	"github.com/sunnystars/backend/internal/model"
)

// PhotoFolder is the upload folder for child photos (diary, gallery, events,
// community). Only uploads in it get the nursery watermark; avatars and logos
// use other folders and stay untouched.
const PhotoFolder = "photos"

const maxWatermarkSource = 25 << 20

func isPhotoKey(key string) bool {
	return strings.Contains(key, "/"+PhotoFolder+"/")
}

// watermarkIfEnabled burns the nursery's watermark into a stored photo and
// overwrites it in place. It is best-effort: any failure leaves the original
// photo as uploaded, since a missing watermark must never lose a photo.
func (s *MediaService) watermarkIfEnabled(ctx context.Context, media *model.Media) {
	if !isPhotoKey(media.Path) || (media.Mime != "image/jpeg" && media.Mime != "image/png") {
		return
	}
	nurseryID, ok := database.TenantFrom(ctx)
	if !ok || nurseryID == 0 {
		return
	}
	var n model.Nursery
	if err := s.db.WithContext(database.WithCrossTenant(ctx)).First(&n, nurseryID).Error; err != nil || !n.WatermarkEnabled {
		return
	}
	markID := n.WatermarkMediaID
	if markID == nil {
		markID = n.LogoMediaID
	}
	if markID == nil {
		return
	}
	var mark model.Media
	if err := s.db.WithContext(ctx).First(&mark, *markID).Error; err != nil {
		return
	}

	markImg, err := s.decodeStored(ctx, mark.Path)
	if err != nil {
		return
	}
	raw, err := s.readStored(ctx, media.Path)
	if err != nil {
		return
	}
	photo, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return
	}
	if media.Mime == "image/jpeg" {
		photo = applyOrientation(photo, jpegOrientation(raw))
	}

	out := stampWatermark(photo, markImg, n.WatermarkPosition, n.WatermarkOpacity)

	var buf bytes.Buffer
	if media.Mime == "image/png" {
		err = png.Encode(&buf, out)
	} else {
		err = jpeg.Encode(&buf, out, &jpeg.Options{Quality: 88})
	}
	if err != nil {
		return
	}
	// Write to a new key, repoint the row, then drop the original: some drivers
	// refuse to overwrite, and the original must survive any failure.
	oldKey := media.Path
	dot := strings.LastIndex(oldKey, ".")
	if dot < 0 {
		return
	}
	newKey := oldKey[:dot] + "_wm" + oldKey[dot:]
	stored, err := s.store.Put(ctx, newKey, bytes.NewReader(buf.Bytes()), media.Mime, int64(buf.Len()))
	if err != nil {
		return
	}
	b := out.Bounds()
	updates := map[string]any{"path": stored.Path, "url": stored.URL, "size": stored.Size, "width": b.Dx(), "height": b.Dy()}
	if err := s.db.WithContext(ctx).Model(media).Updates(updates).Error; err != nil {
		_ = s.store.Delete(ctx, newKey)
		return
	}
	media.Path, media.URL, media.Size, media.Width, media.Height = stored.Path, stored.URL, stored.Size, b.Dx(), b.Dy()
	_ = s.store.Delete(ctx, oldKey)
}

func (s *MediaService) readStored(ctx context.Context, key string) ([]byte, error) {
	rc, err := s.store.Open(ctx, key)
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	return io.ReadAll(io.LimitReader(rc, maxWatermarkSource))
}

func (s *MediaService) decodeStored(ctx context.Context, key string) (image.Image, error) {
	raw, err := s.readStored(ctx, key)
	if err != nil {
		return nil, err
	}
	img, _, err := image.Decode(bytes.NewReader(raw))
	return img, err
}

// stampWatermark draws mark over photo: ~18% of the photo width, at the chosen
// position with a small margin, blended at opacity percent.
func stampWatermark(photo, mark image.Image, position string, opacity uint8) image.Image {
	pb := photo.Bounds()
	dst := image.NewRGBA(image.Rect(0, 0, pb.Dx(), pb.Dy()))
	xdraw.Draw(dst, dst.Bounds(), photo, pb.Min, xdraw.Src)

	mb := mark.Bounds()
	if mb.Dx() == 0 || mb.Dy() == 0 {
		return dst
	}
	w := pb.Dx() * 18 / 100
	if w < 48 {
		w = 48
	}
	h := w * mb.Dy() / mb.Dx()
	scaled := image.NewRGBA(image.Rect(0, 0, w, h))
	xdraw.CatmullRom.Scale(scaled, scaled.Bounds(), mark, mb, xdraw.Over, nil)

	margin := pb.Dx() * 3 / 100
	x, y := pb.Dx()-w-margin, pb.Dy()-h-margin // bottom_right
	switch position {
	case "bottom_left":
		x = margin
	case "top_right":
		y = margin
	case "top_left":
		x, y = margin, margin
	case "center":
		x, y = (pb.Dx()-w)/2, (pb.Dy()-h)/2
	}
	if opacity == 0 || opacity > 100 {
		opacity = 60
	}
	alpha := image.NewUniform(color.Alpha{A: uint8(int(opacity) * 255 / 100)})
	rect := image.Rect(x, y, x+w, y+h)
	xdraw.DrawMask(dst, rect, scaled, image.Point{}, alpha, image.Point{}, xdraw.Over)
	return dst
}

// jpegOrientation reads the EXIF orientation tag (1-8) of a JPEG; 1 if absent.
// Re-encoding drops EXIF, so the rotation must be applied to the pixels.
func jpegOrientation(b []byte) int {
	if len(b) < 4 || b[0] != 0xFF || b[1] != 0xD8 {
		return 1
	}
	i := 2
	for i+4 <= len(b) {
		if b[i] != 0xFF {
			return 1
		}
		marker := b[i+1]
		size := int(binary.BigEndian.Uint16(b[i+2 : i+4]))
		if marker == 0xE1 && i+4+size <= len(b) && size > 8 && bytes.HasPrefix(b[i+4:], []byte("Exif\x00\x00")) {
			return tiffOrientation(b[i+10 : i+2+size])
		}
		if marker == 0xDA { // start of scan: no more metadata
			return 1
		}
		i += 2 + size
	}
	return 1
}

func tiffOrientation(t []byte) int {
	if len(t) < 8 {
		return 1
	}
	var bo binary.ByteOrder
	switch string(t[:2]) {
	case "II":
		bo = binary.LittleEndian
	case "MM":
		bo = binary.BigEndian
	default:
		return 1
	}
	off := int(bo.Uint32(t[4:8]))
	if off+2 > len(t) {
		return 1
	}
	count := int(bo.Uint16(t[off : off+2]))
	for k := 0; k < count; k++ {
		e := off + 2 + k*12
		if e+12 > len(t) {
			return 1
		}
		if bo.Uint16(t[e:e+2]) == 0x0112 {
			v := int(bo.Uint16(t[e+8 : e+10]))
			if v >= 1 && v <= 8 {
				return v
			}
			return 1
		}
	}
	return 1
}

// applyOrientation returns img rotated/flipped so it displays upright.
func applyOrientation(img image.Image, o int) image.Image {
	if o <= 1 || o > 8 {
		return img
	}
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	swap := o >= 5
	dw, dh := w, h
	if swap {
		dw, dh = h, w
	}
	dst := image.NewRGBA(image.Rect(0, 0, dw, dh))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			var nx, ny int
			switch o {
			case 2:
				nx, ny = w-1-x, y
			case 3:
				nx, ny = w-1-x, h-1-y
			case 4:
				nx, ny = x, h-1-y
			case 5:
				nx, ny = y, x
			case 6:
				nx, ny = h-1-y, x
			case 7:
				nx, ny = h-1-y, w-1-x
			case 8:
				nx, ny = y, w-1-x
			}
			dst.Set(nx, ny, img.At(b.Min.X+x, b.Min.Y+y))
		}
	}
	return dst
}
