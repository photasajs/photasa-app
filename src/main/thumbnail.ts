import sharp from "sharp";
import type { IpcMain, IpcMainEvent } from "electron";
import type { Logger } from "log4js";

export function initThumbnailService(ipc: IpcMain, logger: Logger): void {
    ipc.on("picasa:create-thumbnail", async (_event: IpcMainEvent, arg) => {
        const result = await sharp(arg.path)
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
        return result;
    });
}
