import { describe, it, expect } from "vitest";
import { extractCameraInfo, isValidCameraInfo, formatCameraInfo } from "../camera-parser";

describe("Camera Parser", () => {
    describe("extractCameraInfo", () => {
        it("should extract complete camera info from EXIF tags", () => {
            const exifTags = {
                Make: { description: "Canon" },
                Model: { description: "EOS 5D Mark IV" },
                LensModel: { description: "EF24-70mm f/2.8L II USM" },
                ISO: { value: 100 },
                FocalLength: { value: 50 },
                FNumber: { value: 2.8 },
                ExposureTime: { value: 0.008 },
            };

            const result = extractCameraInfo(exifTags);

            expect(result).toEqual({
                make: "Canon",
                model: "EOS 5D Mark IV",
                lens: "EF24-70mm f/2.8L II USM",
                iso: 100,
                focalLength: 50,
                aperture: 2.8,
                shutterSpeed: 0.008,
            });
        });

        it("should handle missing optional fields", () => {
            const exifTags = {
                Make: { description: "Sony" },
                Model: { description: "α7R IV" },
            };

            const result = extractCameraInfo(exifTags);

            expect(result).toEqual({
                make: "Sony",
                model: "α7R IV",
                lens: null,
                iso: null,
                focalLength: null,
                aperture: null,
                shutterSpeed: null,
            });
        });

        it("should handle description fields correctly", () => {
            const exifTags = {
                Make: { description: "Nikon" },
                Model: { description: "D850" },
                LensModel: { description: "24.0-70.0 mm f/2.8" },
            };

            const result = extractCameraInfo(exifTags);

            expect(result).toEqual({
                make: "Nikon",
                model: "D850",
                lens: "24.0-70.0 mm f/2.8",
                iso: null,
                focalLength: null,
                aperture: null,
                shutterSpeed: null,
            });
        });

        it("should handle missing description fields", () => {
            const exifTags = {
                Make: {},
                Model: { description: "X-T4" },
            };

            const result = extractCameraInfo(exifTags);

            expect(result).toEqual({
                make: null,
                model: "X-T4",
                lens: null,
                iso: null,
                focalLength: null,
                aperture: null,
                shutterSpeed: null,
            });
        });

        it("should handle empty EXIF tags", () => {
            const result = extractCameraInfo({});
            expect(result).toEqual({
                make: null,
                model: null,
                lens: null,
                iso: null,
                focalLength: null,
                aperture: null,
                shutterSpeed: null,
            });
        });

        it("should handle missing Make field", () => {
            const exifTags = {
                Model: { description: "EOS R5" },
                LensModel: { description: "RF24-70mm F2.8 L IS USM" },
            };

            const result = extractCameraInfo(exifTags);
            expect(result).toEqual({
                make: null,
                model: "EOS R5",
                lens: "RF24-70mm F2.8 L IS USM",
                iso: null,
                focalLength: null,
                aperture: null,
                shutterSpeed: null,
            });
        });

        it("should handle missing Model field", () => {
            const exifTags = {
                Make: { description: "Canon" },
                LensModel: { description: "RF24-70mm F2.8 L IS USM" },
            };

            const result = extractCameraInfo(exifTags);
            expect(result).toEqual({
                make: "Canon",
                model: null,
                lens: "RF24-70mm F2.8 L IS USM",
                iso: null,
                focalLength: null,
                aperture: null,
                shutterSpeed: null,
            });
        });

        it("should handle null values", () => {
            const result = extractCameraInfo(null);
            expect(result).toBeNull();
        });
    });

    describe("isValidCameraInfo", () => {
        it("should return true for valid camera info", () => {
            const cameraInfo = {
                make: "Canon",
                model: "EOS 5D Mark IV",
                lens: "EF24-70mm f/2.8L II USM",
                software: "Adobe Lightroom 6.14",
            };

            expect(isValidCameraInfo(cameraInfo)).toBe(true);
        });

        it("should return true for minimal valid camera info", () => {
            const cameraInfo = {
                make: "Sony",
                model: "α7R IV",
                lens: undefined,
                software: undefined,
            };

            expect(isValidCameraInfo(cameraInfo)).toBe(true);
        });

        it("should return false for null", () => {
            expect(isValidCameraInfo(null)).toBe(false);
        });

        it("should return false for missing make and model", () => {
            const cameraInfo = {
                make: null,
                model: null,
                lens: null,
                iso: null,
                focalLength: null,
                aperture: null,
                shutterSpeed: null,
            };

            expect(isValidCameraInfo(cameraInfo)).toBe(false);
        });

        it("should return true when only make is present", () => {
            const cameraInfo = {
                make: "Canon",
                model: null,
                lens: null,
                iso: null,
                focalLength: null,
                aperture: null,
                shutterSpeed: null,
            };

            expect(isValidCameraInfo(cameraInfo)).toBe(true);
        });

        it("should return true when only model is present", () => {
            const cameraInfo = {
                make: null,
                model: "EOS R6",
                lens: null,
                iso: null,
                focalLength: null,
                aperture: null,
                shutterSpeed: null,
            };

            expect(isValidCameraInfo(cameraInfo)).toBe(true);
        });
    });

    describe("formatCameraInfo", () => {
        it("should format complete camera info", () => {
            const cameraInfo = {
                make: "Canon",
                model: "EOS 5D Mark IV",
                lens: null,
                iso: null,
                focalLength: null,
                aperture: null,
                shutterSpeed: null,
            };

            const result = formatCameraInfo(cameraInfo);

            expect(result).toBe("Canon EOS 5D Mark IV");
        });

        it("should format camera info with only make", () => {
            const cameraInfo = {
                make: "Sony",
                model: null,
                lens: null,
                iso: null,
                focalLength: null,
                aperture: null,
                shutterSpeed: null,
            };

            const result = formatCameraInfo(cameraInfo);

            expect(result).toBe("Sony");
        });

        it("should format camera info with only model", () => {
            const cameraInfo = {
                make: null,
                model: "D850",
                lens: null,
                iso: null,
                focalLength: null,
                aperture: null,
                shutterSpeed: null,
            };

            const result = formatCameraInfo(cameraInfo);

            expect(result).toBe("D850");
        });

        it("should format minimal camera info", () => {
            const cameraInfo = {
                make: "Fujifilm",
                model: "X-T4",
                lens: null,
                iso: null,
                focalLength: null,
                aperture: null,
                shutterSpeed: null,
            };

            const result = formatCameraInfo(cameraInfo);

            expect(result).toBe("Fujifilm X-T4");
        });

        it("should handle null camera info", () => {
            const result = formatCameraInfo(null);
            expect(result).toBe("Unknown Camera");
        });

        it("should handle camera info with null values", () => {
            const cameraInfo = {
                make: null,
                model: null,
                lens: null,
                iso: null,
                focalLength: null,
                aperture: null,
                shutterSpeed: null,
            };

            const result = formatCameraInfo(cameraInfo);

            expect(result).toBe("Unknown Camera");
        });
    });
});
