#!/usr/bin/env python3
"""Regenerate JPEG metadata fixtures under tests/fixtures/metadata/ (RFC 0112)."""

from pathlib import Path

from PIL import Image
from PIL.ExifTags import Base

ROOT = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "metadata"


def save_exif(path: Path, exif_dict: dict, size=(32, 24), color=(128, 64, 32)) -> None:
    im = Image.new("RGB", size, color=color)
    exif = im.getexif()
    for key, value in exif_dict.items():
        exif[key] = value
    im.save(path, "JPEG", exif=exif, quality=90)


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (32, 24), color=(128, 64, 32)).save(
        ROOT / "minimal-no-exif.jpg", "JPEG", quality=85
    )
    save_exif(
        ROOT / "nikon-exif-sample.jpg",
        {
            Base.Make: "NIKON CORPORATION",
            Base.Model: "NIKON Z 9",
            Base.LensModel: "NIKKOR Z 24-70mm f/2.8 S",
            Base.DateTimeOriginal: "2024:03:15 12:30:00",
            Base.DateTime: "2024:03:15 12:30:00",
            Base.FNumber: 2.8,
            Base.ExposureTime: 1 / 250,
            Base.FocalLength: 70.0,
            Base.ISOSpeedRatings: 400,
        },
    )
    save_exif(
        ROOT / "canon-exif-sample.jpg",
        {
            Base.Make: "Canon",
            Base.Model: "Canon EOS R5",
            Base.DateTimeOriginal: "2023:11:02 08:15:44",
            Base.FNumber: 5.6,
            Base.ExposureTime: 1 / 160,
            Base.FocalLength: 50.0,
            Base.ISOSpeedRatings: 800,
        },
        size=(64, 48),
        color=(200, 100, 50),
    )
    save_exif(
        ROOT / "sony-exif-sample.jpg",
        {
            Base.Make: "SONY",
            Base.Model: "ILCE-7M4",
            Base.DateTimeOriginal: "2022:07:04 16:45:01",
            Base.FNumber: 4.0,
            Base.ExposureTime: 1 / 500,
            Base.FocalLength: 35.0,
            Base.ISOSpeedRatings: 200,
        },
        size=(48, 32),
        color=(50, 80, 120),
    )
    print(f"Wrote JPEG fixtures under {ROOT}")


if __name__ == "__main__":
    main()
