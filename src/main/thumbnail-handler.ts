import isVideo from "is-video";
import { ensureDir, exists, remove, readFile } from "fs-extra";
import decode from "heic-decode";
import type { Logger } from "log4js";
import sharp from "sharp";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { ThumbnailRequest } from "@common/types";
import {
    toPreviewPath,
    HeicExtensionRE,
    getOptimalThumbnailResolution,
    ratioStringToParts,
} from "../common/utils";

//Get the paths to the packaged versions of the binaries we want to use
const ffmpegPath = require("ffmpeg-static").replace("app.asar", "app.asar.unpacked");
const ffprobePath = require("ffprobe-static").path.replace("app.asar", "app.asar.unpacked");

//tell the ffmpeg package where it can find the needed binaries.
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

async function createPreviewImage(arg: ThumbnailRequest, logger: Logger): Promise<string> {
    const previewName = toPreviewPath(arg.path);
    const inputBuffer = await readFile(arg.path);
    try {
        logger.info("Decode HEIC for : " + arg.path);
        const image = await decode({ buffer: inputBuffer });

        logger.info("Create Preview for : " + arg.path);
        await sharp(image.data, {
            raw: {
                width: image.width,
                height: image.height,
                channels: 4,
            },
        })
            .toFormat("jpeg")
            .toFile(previewName);

        return previewName;
    } catch (e) {
        logger.error(e);
        return "";
    }
}

export async function removeThumbnail(arg, logger: Logger): Promise<string> {
    const isExist = await exists(arg.thumbnail);
    if (!isExist) {
        return arg;
    }

    try {
        logger.info("Delete thumbnail for : " + arg.path);
        await remove(arg.thumbnail);
    } catch (e) {
        logger.error(e);
    }

    return arg;
}

function getVideoDimension(video: string): Promise<VideoSize> {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(video, (err, metadata) => {
            if (err) return reject(err);

            const stream = metadata.streams.find((stream) => stream.codec_type === "video");

            const darString = stream?.display_aspect_ratio;

            // ffprobe returns aspect ratios of "0:1" or `undefined` if they're not specified.
            // https://trac.ffmpeg.org/ticket/3798
            if (darString && darString !== "0:1" && darString !== "N/A") {
                // The DAR is specified so use it directly
                const [widthRatioPart, heightRatioPart] = ratioStringToParts(darString);
                const inverseDar = heightRatioPart / widthRatioPart;
                resolve({
                    width: stream.width,
                    height: stream.width * inverseDar,
                });
            } else {
                // DAR not specified so assume square pixels (use sample resolution as-is).
                resolve({
                    width: stream?.width ?? 100,
                    height: stream?.height ?? 100,
                });
            }
        });
    });
}
async function createScreenshot(arg, logger: Logger): Promise<string> {
    const dimension = await getVideoDimension(arg.path);
    return new Promise((resolve) => {
        const size = getOptimalThumbnailResolution(dimension, arg);
        ffmpeg(arg.path)
            .on("filenames", function (filenames) {
                logger.info("Generate Screenshot: " + filenames.join(", "));
            })
            .on("error", function (err) {
                logger.error(err);
                resolve(arg.thumbnail);
            })
            .on("end", function () {
                resolve(arg.thumbnail);
            })
            .screenshots({
                timestamps: ["1%"],
                filename: path.basename(arg.thumbnail),
                folder: path.dirname(arg.thumbnail),
                size: `${size.width}x${size.height}`,
            });
    });
}

export async function createThumbnail(
    arg: ThumbnailRequest,
    logger: Logger,
): Promise<ThumbnailRequest> {
    const isExist = await exists(arg.thumbnail);
    if (!arg.always && isExist) {
        return Promise.resolve(arg);
    }

    await removeThumbnail(arg, logger);

    await ensureDir(path.dirname(arg.thumbnail));

    let isHeic = HeicExtensionRE.test(arg.path);
    // If it's a HEIC file, we need to convert it to a PNG first for preview
    if (isHeic) {
        arg.preview = await createPreviewImage(arg, logger);
        // Convert may failed, then it's not HEIC
        isHeic = arg.preview !== "";
    }

    try {
        if (isVideo(arg.path)) {
            logger.info("Create video thumbnail for : " + arg.path);
            await createScreenshot(arg, logger);
        } else {
            logger.info("Create image thumbnail for : " + arg.path);
            const target = isHeic ? arg.preview : arg.path;
            await sharp(target)
                .rotate()
                .resize(arg.width, arg.height, {
                    fit: sharp.fit.inside,
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
