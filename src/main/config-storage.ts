import fs from "fs-extra";
import path from "path";
import type { PhotasaConfig, PhotoConfigResult } from "../preload/types";
import * as R from "ramda";
import { toRelativeThumbnailPath } from "../common/utils";

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

/**
 * Add photo to .photasa.json
 *
 * @param photo path of photo
 * @returns path of .photasa.json
 */
export async function addToPhotoList(photoPath: string): Promise<PhotoConfigResult> {
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
export async function removeFromPhotoList(photoPath: string): Promise<PhotoConfigResult> {
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
