package service

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"testing"
)

func solid(w, h int, c color.Color) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, c)
		}
	}
	return img
}

func TestStampWatermarkBottomRight(t *testing.T) {
	photo := solid(1000, 500, color.RGBA{255, 0, 0, 255})
	mark := solid(100, 50, color.RGBA{0, 0, 255, 255})

	out := stampWatermark(photo, mark, "bottom_right", 100)

	// Mark is 18% of width (180x90) with a 3% (30px) margin.
	if r, _, b, _ := out.At(1000-30-10, 500-30-10).RGBA(); b>>8 < 200 || r>>8 > 50 {
		t.Fatalf("expected watermark in bottom-right corner, got r=%d b=%d", r>>8, b>>8)
	}
	if r, _, b, _ := out.At(10, 10).RGBA(); r>>8 < 200 || b>>8 > 50 {
		t.Fatalf("top-left should be untouched photo, got r=%d b=%d", r>>8, b>>8)
	}
}

func TestStampWatermarkOpacityBlends(t *testing.T) {
	photo := solid(1000, 500, color.RGBA{255, 0, 0, 255})
	mark := solid(100, 50, color.RGBA{0, 0, 255, 255})

	out := stampWatermark(photo, mark, "center", 50)

	r, _, b, _ := out.At(500, 250).RGBA()
	if r>>8 < 90 || r>>8 > 165 || b>>8 < 90 || b>>8 > 165 {
		t.Fatalf("expected ~50%% blend at center, got r=%d b=%d", r>>8, b>>8)
	}
}

func TestApplyOrientationRotates(t *testing.T) {
	img := solid(40, 20, color.White)
	if b := applyOrientation(img, 6).Bounds(); b.Dx() != 20 || b.Dy() != 40 {
		t.Fatalf("orientation 6 should swap dimensions, got %dx%d", b.Dx(), b.Dy())
	}
	if b := applyOrientation(img, 1).Bounds(); b.Dx() != 40 || b.Dy() != 20 {
		t.Fatalf("orientation 1 should keep dimensions, got %dx%d", b.Dx(), b.Dy())
	}
}

func TestJPEGOrientationWithoutExif(t *testing.T) {
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, solid(8, 8, color.White), nil); err != nil {
		t.Fatal(err)
	}
	if o := jpegOrientation(buf.Bytes()); o != 1 {
		t.Fatalf("expected 1 for a JPEG without EXIF, got %d", o)
	}
}

func TestIsPhotoKey(t *testing.T) {
	if !isPhotoKey("nursery_1/photos/ab12.jpg") || isPhotoKey("nursery_1/avatars/ab12.jpg") {
		t.Fatal("only the photos folder should be watermarked")
	}
}
