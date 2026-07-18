import type { CameraInfo } from "@photasa/common";

/**
 * 从EXIF数据中提取相机信息
 * @param exifData EXIF数据对象
 * @returns 相机信息或null
 */
export function extractCameraInfo(exifData: any): CameraInfo | null {
    if (!exifData) return null;

    return {
        make: exifData.Make?.description || null,
        model: exifData.Model?.description || null,
        lens: exifData.LensModel?.description || null,
        iso: exifData.ISO?.value || null,
        focalLength: exifData.FocalLength?.value || null,
        aperture: exifData.FNumber?.value || null,
        shutterSpeed: exifData.ExposureTime?.value || null,
    };
}

/**
 * 验证相机信息是否有效
 * @param cameraInfo 相机信息
 * @returns 是否有效
 */
export function isValidCameraInfo(cameraInfo: CameraInfo | null): boolean {
    return !!(cameraInfo?.make || cameraInfo?.model);
}

/**
 * 格式化相机信息为显示字符串
 * @param cameraInfo 相机信息
 * @returns 格式化的字符串
 */
export function formatCameraInfo(cameraInfo: CameraInfo | null): string {
    if (!cameraInfo) return "Unknown Camera";

    const parts: string[] = [];
    if (cameraInfo.make) parts.push(cameraInfo.make);
    if (cameraInfo.model) parts.push(cameraInfo.model);

    return parts.length > 0 ? parts.join(" ") : "Unknown Camera";
}
