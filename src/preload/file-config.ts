import fs from "fs-extra";
import path from "path";
import type { PhotasaConfig, LoadCallback } from "./types";
import * as R from "ramda";
import { buildThumbnailPath } from "./image-helper";
import { queryPhotasaConfigs } from "./query-config";

const PHOTASA_VERSION = "1.0";

async function ensureConfig(photo: string, isFile = true): Promise<string> {
    const dir = isFile ? path.dirname(photo) : photo;
    const configPath = path.join(dir, ".photasa.json");
    await fs.ensureFile(configPath);
    return configPath;
}

async function readConfig(photo: string, isFile = true): Promise<{ data: string; dir: string }> {
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
export async function addToPhotoList(
    photoPath: string,
): Promise<{ path: string; config: PhotasaConfig }> {
    const meta = await readConfig(photoPath);
    const photasaConfig = parseConfig(meta.data);
    const photo = photasaConfig.photoList.find((p) => p.path === photoPath);

    if (!photo) {
        photasaConfig.photoList.push({
            path: photoPath,
            thumbnail: buildThumbnailPath(photoPath),
            history: [],
        });
        writeConfig(meta.dir, photasaConfig);
    } else if (!photo.thumbnail) {
        photo.thumbnail = buildThumbnailPath(photoPath);
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
export async function removeFromPhotoList(
    photoPath: string,
): Promise<{ path: string; config: PhotasaConfig }> {
    const meta = await readConfig(photoPath);
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

export async function loadPhotasaConfigs(paths: string[], callback: LoadCallback): Promise<void> {
    queryPhotasaConfigs(paths, (action, path) => {
        callback(action, path);
    });
}
