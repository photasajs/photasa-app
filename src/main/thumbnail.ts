import isVideo from "is-video";
import { ensureDir, exists, remove } from "fs-extra";
import sharp from "sharp";
import type { IpcMain } from "electron";
import type { Logger } from "log4js";
import path from "path";
import ffmpeg from "fluent-ffmpeg";

//Get the paths to the packaged versions of the binaries we want to use
const ffmpegPath = require("ffmpeg-static").replace("app.asar", "app.asar.unpacked");
const ffprobePath = require("ffprobe-static").path.replace("app.asar", "app.asar.unpacked");

//tell the ffmpeg package where it can find the needed binaries.
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

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

function createScreenshot(arg, logger: Logger): Promise<string> {
    return new Promise((resolve, reject) => {
        ffmpeg(arg.path)
            .on("filenames", function (filenames) {
                logger.info("Will generate screenshot: " + filenames.join(", "));
            })
            .on("error", function (err) {
                reject(err);
            })
            .on("end", function () {
                resolve(arg.thumbnail);
            })
            .screenshots({
                timestamps: ["50%"],
                filename: path.basename(arg.thumbnail),
                folder: path.dirname(arg.thumbnail),
                size: `${arg.width}x${arg.height}`,
            });
    });
}

export async function createThumbnail(arg, logger: Logger): Promise<string> {
    const isExist = await exists(arg.thumbnail);
    if (isExist) {
        return Promise.resolve(arg);
    }

    await ensureDir(path.dirname(arg.thumbnail));
    try {
        logger.info("Creating thumbnail for : " + arg.path);
        if (isVideo(arg.path)) {
            await createScreenshot(arg, logger);
        } else {
            await sharp(arg.path)
                .resize(arg.width, arg.height, {
                    fit: sharp.fit.inside,
                    withoutEnlargement: arg.withoutEnlargement,
                })
                .toFormat("png")
                .toFile(arg.thumbnail)
                .then((i) => {
                    logger.info(i);
                });
        }
    } catch (e) {
        logger.error("Failed to create thumbnail: " + arg.path + " due to: " + e);
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
