import { ensureDir, exists, remove } from "fs-extra";
import sharp from "sharp";
import type { IpcMain } from "electron";
import type { Logger } from "log4js";
import path from "path";

export async function removeThumbnail(arg, logger: Logger): Promise<string> {
    const isExist = await exists(arg.thumbnail);
    if (!isExist) {
        return arg;
    }

    try {
        await remove(arg.thumbnail);
    } catch (e) {
        logger.error(e);
    }

    return arg;
}

export async function createThumbnail(arg, logger: Logger): Promise<string> {
    const isExist = await exists(arg.thumbnail);
    if (isExist) {
        return Promise.resolve(arg);
    }

    await ensureDir(path.dirname(arg.thumbnail));

    try {
        await sharp(arg.path)
            .resize(arg.width, arg.height, {
                fit: sharp.fit.inside,
                withoutEnlargement: arg.withoutEnlargement,
            })
            .toFormat("jpeg")
            .toFile(arg.thumbnail)
            .then((i) => {
                logger.info(i);
            });
    } catch (e) {
        logger.error("Failed to create thumbnail: " + arg.path + " due to: " + e)
    }
    return arg;
}

export function initThumbnailService(ipc: IpcMain, logger: Logger): void {
    ipc.handle("picasa:create-thumbnail", async (_, arg) => {
        return await createThumbnail(arg, logger);
    });
    ipc.handle("picasa:remove-thumbnail", async (_, arg) => {
        return await removeThumbnail(arg, logger);
    });
}
