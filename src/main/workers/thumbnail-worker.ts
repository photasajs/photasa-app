import { parentPort } from "worker_threads";
import sharp from "sharp";
import { buildThumbnailPath } from "@common/utils";

/**
 * Interface for the thumbnail request object
 * @property file - The path to the file to generate a thumbnail for
 * @property size - The size of the thumbnail
 * @property quality - The quality of the thumbnail
 */
export interface ThumbnailRequest {
    file: string;
    size: number;
    quality?: number;
}

/**
 * Interface for the thumbnail response object
 * @property success - Whether the thumbnail generation was successful
 * @property file - The path to the thumbnail file
 * @property error - An error message if the thumbnail generation fails
 */
export interface ThumbnailResponse {
    success: boolean;
    file: string;
    error?: string;
}

const DEFAULT_QUALITY = 80;

/**
 * Generate a thumbnail for a given file
 * @param request - The request object containing the file path, size, and quality
 * @returns The thumbnail path or an error message if the thumbnail generation fails
 */
async function generateThumbnail(request: ThumbnailRequest): Promise<ThumbnailResponse> {
    try {
        const { file, size, quality = DEFAULT_QUALITY } = request;
        const thumbnailPath = buildThumbnailPath(file);

        // Ensure thumbnail directory exists
        await sharp(file)
            .resize(size, size, {
                fit: "inside",
                withoutEnlargement: true,
            })
            .jpeg({
                quality,
                progressive: true,
            })
            .toFile(thumbnailPath);

        return {
            success: true,
            file,
        };
    } catch (error) {
        return {
            success: false,
            file: request.file,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

// Handle messages from the main thread
parentPort?.on("message", async (message: string) => {
    try {
        const request = JSON.parse(message) as ThumbnailRequest;
        const result = await generateThumbnail(request);
        parentPort?.postMessage(JSON.stringify(result));
    } catch (error) {
        parentPort?.postMessage(
            JSON.stringify({
                success: false,
                file: message,
                error: error instanceof Error ? error.message : "Unknown error",
            }),
        );
    }
});
