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

function checkHEIC(file: string): boolean {
    if (file.indexOf(".heic") >= 0) {
        return true;
    }
    return false;
}

export async function removeThumbnail(arg, logger: Logger): Promise<string> {
    const isExist = await exists(arg.thumbnail);
    if (!isExist) {
        return arg;
    }

    try {
        logger.info("Cleaning thumbnail for : " + arg.path);
        await remove(arg.thumbnail);
    } catch (e) {
        logger.error(e);
    }

    return arg;
}

function createScreenshot(arg, logger: Logger): Promise<string> {
    return new Promise((resolve) => {
        ffmpeg(arg.path)
            .on("filenames", function (filenames) {
                logger.info("Will generate screenshot: " + filenames.join(", "));
            })
            .on("error", function (err) {
                logger.error(err);
            })
            .on("end", function () {
                resolve(arg.thumbnail);
            })
            .screenshots({
                timestamps: ["1%"],
                filename: path.basename(arg.thumbnail),
                folder: path.dirname(arg.thumbnail),
                size: `${arg.width}x${arg.height}`,
            });
    });
}

export async function createThumbnail(arg, logger: Logger): Promise<string> {
    const isExist = await exists(arg.thumbnail);
    if (!arg.always && isExist) {
        return Promise.resolve(arg);
    }

    await removeThumbnail(arg, logger);

    await ensureDir(path.dirname(arg.thumbnail));

    const isHeic = checkHEIC(arg.path);

    try {
        logger.info("Creating thumbnail for : " + arg.path);
        if (isVideo(arg.path)) {
            await createScreenshot(arg, logger);
        } else {
            const target = isHeic ? arg.preview : arg.path;
            await sharp(target)
                .rotate()
                .resize(arg.width, arg.height, {
                    fit: sharp.fit.contain,
                    background: "white",
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
