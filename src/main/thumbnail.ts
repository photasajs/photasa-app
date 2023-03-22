import isVideo from "is-video";
import { ensureDir, exists, remove, readFile, writeFile } from "fs-extra";
import sharp from "sharp";
import type { IpcMain } from "electron";
import type { Logger } from "log4js";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import convert from "heic-convert";

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
                timestamps: [15.5],
                filename: path.basename(arg.thumbnail),
                folder: path.dirname(arg.thumbnail),
                size: `${arg.width}x${arg.height}`,
            });
    });
}

async function extractPngFromHeic(arg, logger: Logger): Promise<string> {
    const fileName = path.basename(arg.path, path.extname(arg.path));
    const previewName = path.join(path.dirname(arg.path), `.photasaoriginals/${fileName}.jpeg`);
    const inputBuffer = await readFile(arg.path);
    try {
        const outputBuffer = await convert({
            buffer: inputBuffer, // the HEIC file buffer
            format: "JPEG", // output format
            quality: 1, // the jpeg compression quality, between 0 and 1
        });

        logger.info("Creating preview for : " + arg.path);
        await writeFile(previewName, outputBuffer);
        return previewName;
    } catch {
        return "";
    }
}

export async function createThumbnail(arg, logger: Logger): Promise<string> {
    const isExist = await exists(arg.thumbnail);
    if (isExist) {
        return Promise.resolve(arg);
    }

    await ensureDir(path.dirname(arg.thumbnail));

    let isHeic = checkHEIC(arg.path);
    // If it's a HEIC file, we need to convert it to a PNG first for preview
    if (isHeic) {
        arg.preview = await extractPngFromHeic(arg, logger);

        // Convert may failed, then it's not HEIC
        isHeic = arg.preview !== "";
    }

    try {
        logger.info("Creating thumbnail for : " + arg.path);
        if (isVideo(arg.path)) {
            await createScreenshot(arg, logger);
        } else {
            const target = isHeic ? arg.preview : arg.path;
            await sharp(target)
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
