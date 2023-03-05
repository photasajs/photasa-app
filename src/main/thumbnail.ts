import { ensureDirSync } from "fs-extra";
import sharp from "sharp";
import type { IpcMain } from "electron";
import type { Logger } from "log4js";
import { existsSync } from "fs";
import path from "path";

export async function createThumbnail(arg, logger: Logger): Promise<string> {
    if (existsSync(arg.thumbnail)) {
        return Promise.resolve(arg.thumbnail);
    }

    ensureDirSync(path.dirname(arg.thumbnail));
    return await sharp(arg.path)
        .resize(arg.width, arg.height, {
            fit: sharp.fit.inside,
            withoutEnlargement: arg.withoutEnlargement,
        })
        .toFormat("jpeg")
        .toFile(arg.thumbnail)
        .then((i) => {
            logger.info(i);
            return arg.thumbnail;
        })
        .catch((err) => {
            logger.error(err);
            return arg;
        });
}

export function initThumbnailService(ipc: IpcMain, logger: Logger): void {
    ipc.handle("picasa:create-thumbnail", async (_, arg) => {
        return await createThumbnail(arg, logger);
    });
}
