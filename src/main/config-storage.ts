import fs from "fs-extra";
import path from "path";
import type { PhotasaConfig, PhotasaConfigResult } from "../preload/types";
import * as R from "ramda";
import { toRelativeThumbnailPath } from "../common/utils";
import TaskRunner from "concurrent-tasks";
import { Logger } from "log4js";
import { concatMap, from } from "rxjs";
import isVideo from "is-video";

const PHOTASA_VERSION = "1.0";

async function ensureConfig(photo: string, isFile: boolean): Promise<string> {
    const dir = isFile ? path.dirname(photo) : photo;
    const configPath = path.join(dir, ".photasa.json");
    await fs.ensureFile(configPath);
    return configPath;
}

async function readConfig(photo: string, isFile: boolean): Promise<{ data: string; dir: string }> {
    const dir = await ensureConfig(photo, isFile);
    const data = (await fs.readFile(dir, "utf-8")) ?? "{}";
    return {
        dir,
        data: data ? data : "{}",
    };
}

async function writeConfig(configPath: string, photoConfig: PhotasaConfig): Promise<void> {
    photoConfig.lastModified = Date.now();
    const data = JSON.stringify(photoConfig, null, 4);
    await fs.writeFile(configPath, data, { encoding: "utf8", flag: "w" });
}

function fromJson(data: string): PhotasaConfig {
    try {
        return <PhotasaConfig>JSON.parse(data);
    } catch {
        return <PhotasaConfig>{};
    }
}

function normalizeConfig(config: PhotasaConfig): PhotasaConfig {
    if (!config.photoList) {
        config.photoList = [];
    }
    if (!config.version) {
        config.version = PHOTASA_VERSION;
    }
    return config;
}

const parseConfig = R.compose(normalizeConfig, fromJson);
export async function batchAddToPhotoList(
    parent: string,
    photoPaths: string[],
): Promise<PhotasaConfigResult> {
    const meta = await readConfig(parent, false);
    const photasaConfig = parseConfig(meta.data);
    photoPaths.forEach((photoPath) => {
        const fileName = toFileName(photoPath);
        const photo = photasaConfig.photoList.find((p) => p.path === fileName);
        const thumbnailName = toRelativeThumbnailPath(photoPath);
        if (!photo) {
            photasaConfig.photoList.push({
                path: fileName,
                thumbnail: thumbnailName,
                history: [],
                isVideo: isVideo(fileName),
            });
        } else if (!photo.thumbnail) {
            photo.thumbnail = thumbnailName;
        }
    });

    await writeConfig(meta.dir, photasaConfig);

    return {
        path: meta.dir,
        config: photasaConfig,
    };
}
/**
 * Add photo to .photasa.json
 *
 * @param photo path of photo
 * @returns path of .photasa.json
 */
export async function addToPhotoList(photoPath: string): Promise<PhotasaConfigResult> {
    const meta = await readConfig(photoPath, true);
    const photasaConfig = parseConfig(meta.data);
    const fileName = toFileName(photoPath);
    const photo = photasaConfig.photoList.find((p) => p.path === fileName);
    const thumbnailName = toRelativeThumbnailPath(photoPath);
    if (!photo) {
        photasaConfig.photoList.push({
            path: fileName,
            thumbnail: thumbnailName,
            history: [],
            isVideo: isVideo(fileName),
        });
        writeConfig(meta.dir, photasaConfig);
    } else if (!photo.thumbnail) {
        photo.thumbnail = thumbnailName;
        writeConfig(meta.dir, photasaConfig);
    }
    return {
        path: meta.dir,
        config: photasaConfig,
    };
}

/**
 * Remove photo to .photasa.json
 *
 * @param photo path of photo
 * @returns path of .photasa.json and config of photasa
 */
export async function removeFromPhotoList(photoPath: string): Promise<PhotasaConfigResult> {
    const meta = await readConfig(photoPath, true);
    const photasaConfig = parseConfig(meta.data);
    const photoIndex = photasaConfig.photoList.findIndex((p) => p.path === photoPath);

    if (photoIndex >= 0) {
        photasaConfig.photoList.splice(photoIndex, 1);
        writeConfig(meta.dir, photasaConfig);
    }
    return {
        path: meta.dir,
        config: photasaConfig,
    };
}

export async function getPhotasaConfig(folder: string): Promise<PhotasaConfig> {
    const meta = await readConfig(folder, false);
    return parseConfig(meta.data);
}

/**
 * Reset photasa config photo list
 */
export async function resetPhotasaConfig(folder: string): Promise<PhotasaConfig> {
    const meta = await readConfig(folder, false);
    const photasaConfig = parseConfig(meta.data);
    photasaConfig.photoList = [];
    await writeConfig(meta.dir, photasaConfig);
    return photasaConfig;
}

export async function fixPhotasaConfig(folder: string): Promise<PhotasaConfig> {
    const meta = await readConfig(folder, false);
    const config = parseConfig(meta.data);
    config.photoList.forEach((photo) => {
        photo.path = toFileName(photo.path);
        photo.thumbnail = toThumbnailName(photo.thumbnail);
    });

    writeConfig(meta.dir, config);

    return config;
}

export function toFileName(file: string): string {
    return path.basename(file);
}

export function toThumbnailName(file: string): string {
    return `.photasaoriginals/${path.basename(file)}`;
}

const addTaskRunner = new TaskRunner();
addTaskRunner.setConcurrency(1);
let addPathQueue = {};
const DELAY_NOTIFY_DONE = 3000;
const QUEUE_BREAK_THRESHOLD = 60;
let lastQueuedCount = 0;

function waitedFilesCount(): number {
    return Object.entries<string[]>(addPathQueue).reduce((acc, entry) => acc + entry[1].length, 0);
}

function addConfig(
    request: { queueId: number; paths: string[] },
    logger: Logger,
    postMessage: (message: string) => void,
    done: () => void,
): void {
    const queued = Object.entries<string[]>(addPathQueue);
    addPathQueue = {};
    logger.info(
        `Process ${queued.reduce(
            (acc, entry) => acc + entry[1].length,
            0,
        )} files to photasa config`,
    );
    from(queued)
        .pipe(concatMap(([key, value]) => batchAddToPhotoList(key, value)))
        .subscribe({
            next: (result: PhotasaConfigResult) => {
                postMessage(
                    JSON.stringify({
                        action: "next",
                        queueId: request.queueId,
                        from: "add",
                        ...result,
                    }),
                );
            },
            error: (err) => {
                postMessage(
                    JSON.stringify({
                        action: "error",
                        queueId: request.queueId,
                        from: "add",
                        err,
                    }),
                );
            },
            complete: () => {
                postMessage(
                    JSON.stringify({
                        action: "complete",
                        queueId: request.queueId,
                        from: "add",
                    }),
                );
                // Write to disk is time consuming, so we delay the notification so we can handle more saving
                const handlerId = setInterval(() => {
                    const count = waitedFilesCount();
                    logger.info(`Totally ${count} files are waiting`);
                    // if count isn't changed then process it
                    if (count >= QUEUE_BREAK_THRESHOLD || count === lastQueuedCount) {
                        lastQueuedCount = 0;
                        clearInterval(handlerId);
                        done();
                    } else {
                        lastQueuedCount = count;
                    }
                }, DELAY_NOTIFY_DONE);
            },
        });
}

export function addToPhotasaConfig(
    request: { queueId: number; paths: string[] },
    postMessage: (message: string) => void,
    logger: Logger,
): void {
    request.paths.forEach((p) => {
        const dir = path.dirname(p);
        addPathQueue[dir] = addPathQueue[dir] || [];
        addPathQueue[dir].push(p);
    });

    addTaskRunner.add((done) => {
        addConfig(request, logger, postMessage, done);
    });
}
