import type { GPSInfo } from "@photasa/common";

/**
 * 解析GPS坐标字符串为十进制度数
 * @param coordinate GPS坐标字符串，格式如 "39° 54' 36.00""
 * @param ref 参考方向 (N/S/E/W)
 * @returns 十进制度数
 */
export function parseGPSCoordinate(coordinate: string, ref?: string): number {
    const parts = coordinate.match(/(\d+)°\s*(\d+)'\s*([\d.]+)"/);
    if (!parts) return 0;

    const degrees = parseInt(parts[1]);
    const minutes = parseInt(parts[2]);
    const seconds = parseFloat(parts[3]);

    let decimal = degrees + minutes / 60 + seconds / 3600;

    // 根据参考方向调整符号
    if (ref === "S" || ref === "W") {
        decimal = -decimal;
    }

    return decimal;
}

/**
 * 从EXIF数据中提取GPS信息
 * @param exifData EXIF数据对象
 * @returns GPS信息或null
 */
export function extractGPSInfo(exifData: any): GPSInfo | null {
    if (!exifData?.GPSLatitude || !exifData?.GPSLongitude) return null;

    try {
        return {
            latitude: parseGPSCoordinate(
                exifData.GPSLatitude.description,
                exifData.GPSLatitudeRef?.description,
            ),
            longitude: parseGPSCoordinate(
                exifData.GPSLongitude.description,
                exifData.GPSLongitudeRef?.description,
            ),
            altitude: exifData.GPSAltitude?.value || null,
        };
    } catch (error) {
        return null;
    }
}

/**
 * 解析ISO6709格式的GPS字符串
 * @param locationString 位置字符串，如 "+37.7749-122.4194/"
 * @returns GPS信息或null
 */
export function parseISO6709GPS(locationString: string): GPSInfo | null {
    try {
        const match = locationString.match(/([+-]\d+\.?\d*)([+-]\d+\.?\d*)/);
        if (match) {
            return {
                latitude: parseFloat(match[1]),
                longitude: parseFloat(match[2]),
            };
        }
    } catch (error) {
        // 忽略解析错误
    }
    return null;
}

/**
 * 从视频元数据中提取GPS信息
 * @param metadata 视频元数据
 * @returns GPS信息或null
 */
export function extractVideoGPS(metadata: any): GPSInfo | null {
    const locationFields = ["location", "com.apple.quicktime.location.ISO6709"];

    for (const stream of metadata.streams) {
        for (const field of locationFields) {
            const location = stream.tags?.[field];
            if (location) {
                return parseISO6709GPS(location);
            }
        }
    }

    return null;
}
