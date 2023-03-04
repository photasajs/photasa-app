import sharp from "sharp";
import type { IpcMain } from "electron";
import type { Logger } from "log4js";

export async function createThumbnail(arg, logger: Logger): Promise<string> {
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
