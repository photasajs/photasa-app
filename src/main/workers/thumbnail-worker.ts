import { parentPort } from "worker_threads";
import sharp from "sharp";
import { buildThumbnailPath } from "../../common";

interface ThumbnailRequest {
    file: string;
    size: number;
    quality?: number;
}

interface ThumbnailResponse {
    success: boolean;
    file: string;
    error?: string;
}

async function generateThumbnail(request: ThumbnailRequest): Promise<ThumbnailResponse> {
    try {
        const { file, size, quality = 80 } = request;
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
