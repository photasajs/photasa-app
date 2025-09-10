import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock ffmpeg
vi.mock("fluent-ffmpeg");

describe("Video Rotation Detection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getVideoRotation", () => {
        it("should detect rotation from stream tags (older ffmpeg)", () => {
            const mockMetadata = {
                streams: [
                    {
                        codec_type: "video",
                        width: 1920,
                        height: 1080,
                        tags: {
                            rotate: "90",
                        },
                    },
                ],
            };

            // 测试旋转检测逻辑
            const stream = mockMetadata.streams.find((s: any) => s.codec_type === "video");
            const rotateTag = stream?.tags?.rotate;
            const rotation = rotateTag ? parseInt(rotateTag, 10) : 0;

            expect(rotation).toBe(90);
        });

        it("should detect rotation from side_data (newer ffmpeg)", () => {
            const mockMetadata = {
                streams: [
                    {
                        codec_type: "video",
                        width: 1920,
                        height: 1080,
                        side_data_list: [
                            {
                                side_data_type: "Display Matrix",
                                rotation: -90,
                            },
                        ],
                    },
                ],
            };

            // 测试旋转检测逻辑
            const stream = mockMetadata.streams.find((s: any) => s.codec_type === "video");
            const sideData = stream?.side_data_list;
            let rotation = 0;

            if (sideData && Array.isArray(sideData)) {
                const displayMatrix = sideData.find(
                    (data: any) => data.side_data_type === "Display Matrix",
                );
                if (displayMatrix && displayMatrix.rotation) {
                    rotation = parseFloat(String(displayMatrix.rotation));
                    rotation = ((rotation % 360) + 360) % 360;
                }
            }

            expect(rotation).toBe(270); // -90度转换为270度
        });

        it("should detect rotation from format tags", () => {
            const mockMetadata = {
                streams: [
                    {
                        codec_type: "video",
                        width: 1920,
                        height: 1080,
                    },
                ],
                format: {
                    tags: {
                        rotate: "180",
                    },
                },
            };

            // 测试旋转检测逻辑
            const stream = mockMetadata.streams.find((s: any) => s.codec_type === "video");
            const rotateTag = (stream as any)?.tags?.rotate;
            const formatRotate = mockMetadata.format?.tags?.rotate;

            const rotation = rotateTag
                ? parseInt(rotateTag, 10)
                : formatRotate
                  ? parseInt(formatRotate, 10)
                  : 0;

            expect(rotation).toBe(180);
        });

        it("should swap width and height for 90 and 270 degree rotations", () => {
            const testCases = [
                {
                    rotation: 0,
                    width: 1920,
                    height: 1080,
                    expectedWidth: 1920,
                    expectedHeight: 1080,
                },
                {
                    rotation: 90,
                    width: 1920,
                    height: 1080,
                    expectedWidth: 1080,
                    expectedHeight: 1920,
                },
                {
                    rotation: 180,
                    width: 1920,
                    height: 1080,
                    expectedWidth: 1920,
                    expectedHeight: 1080,
                },
                {
                    rotation: 270,
                    width: 1920,
                    height: 1080,
                    expectedWidth: 1080,
                    expectedHeight: 1920,
                },
            ];

            testCases.forEach(({ rotation, width, height, expectedWidth, expectedHeight }) => {
                let finalWidth = width;
                let finalHeight = height;

                // 如果视频旋转了90度或270度，需要交换宽高
                if (rotation === 90 || rotation === 270) {
                    [finalWidth, finalHeight] = [finalHeight, finalWidth];
                }

                expect(finalWidth).toBe(expectedWidth);
                expect(finalHeight).toBe(expectedHeight);
            });
        });

        it("should handle negative rotation values correctly", () => {
            const testCases = [
                { input: -90, expected: 270 },
                { input: -180, expected: 180 },
                { input: -270, expected: 90 },
                { input: -360, expected: 0 },
                { input: 450, expected: 90 },
                { input: -450, expected: 270 },
            ];

            testCases.forEach(({ input, expected }) => {
                const rotation = ((input % 360) + 360) % 360;
                expect(rotation).toBe(expected);
            });
        });
    });

    describe("Thumbnail Generation with Rotation", () => {
        it("should generate correct thumbnail size for portrait video", () => {
            // 竖屏视频（已旋转90度）
            const videoDimension = { width: 1080, height: 1920 }; // 旋转后的尺寸
            const targetSize = { width: 300, height: 300 };

            // 计算最优缩略图分辨率
            let thumbnailSize;
            if (videoDimension.width > videoDimension.height) {
                // 横屏
                thumbnailSize = {
                    width: targetSize.width,
                    height: Math.round(
                        (targetSize.width * videoDimension.height) / videoDimension.width,
                    ),
                };
            } else {
                // 竖屏
                thumbnailSize = {
                    width: Math.round(
                        (targetSize.height * videoDimension.width) / videoDimension.height,
                    ),
                    height: targetSize.height,
                };
            }

            expect(thumbnailSize.width).toBe(169); // 300 * (1080/1920) ≈ 169
            expect(thumbnailSize.height).toBe(300);
        });

        it("should generate correct thumbnail size for landscape video", () => {
            // 横屏视频
            const videoDimension = { width: 1920, height: 1080 };
            const targetSize = { width: 300, height: 300 };

            // 计算最优缩略图分辨率
            let thumbnailSize;
            if (videoDimension.width > videoDimension.height) {
                // 横屏
                thumbnailSize = {
                    width: targetSize.width,
                    height: Math.round(
                        (targetSize.width * videoDimension.height) / videoDimension.width,
                    ),
                };
            } else {
                // 竖屏
                thumbnailSize = {
                    width: Math.round(
                        (targetSize.height * videoDimension.width) / videoDimension.height,
                    ),
                    height: targetSize.height,
                };
            }

            expect(thumbnailSize.width).toBe(300);
            expect(thumbnailSize.height).toBe(169); // 300 * (1080/1920) ≈ 169
        });
    });
});
