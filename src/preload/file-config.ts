import fs from "fs-extra";
import path from "path";
import type { PhotasaConfig, LoadCallback } from "./types";
import { toFileName, shortenThumbnailName } from "../common";
import * as R from "ramda";
import isVideo from "is-video";

import { electronAPI } from "@electron-toolkit/preload";
const { ipcRenderer } = electronAPI;

const PHOTASA_VERSION = "1.0";

export async function ensureConfig(photo: string, isFile: boolean): Promise<string> {
    const dir = isFile ? path.dirname(photo) : photo;
    const configPath = path.join(dir, ".photasa.json");
    await fs.ensureFile(configPath);
    return configPath;
}

export async function readConfig(
    photo: string,
    isFile: boolean,
): Promise<{ data: string; dir: string }> {
    const dir = await ensureConfig(photo, isFile);
    const data = (await fs.readFile(dir, "utf-8")) ?? "{}";
    return {
        dir,
        data: data ? data : "{}",
    };
}

export async function writeConfig(configPath: string, photoConfig: PhotasaConfig): Promise<void> {
    photoConfig.lastModified = Date.now();
    const data = JSON.stringify(photoConfig, null, 4);
    await fs.writeFile(configPath, data, { encoding: "utf8", flag: "w" });
}

export function fromJson(data: string): PhotasaConfig {
    try {
        return <PhotasaConfig>JSON.parse(data);
    } catch {
        return <PhotasaConfig>{};
    }
}

export function normalizeConfig(config: PhotasaConfig): PhotasaConfig {
    if (!config.photoList) {
        config.photoList = [];
    }
    if (!config.version) {
        config.version = PHOTASA_VERSION;
    }
    return config;
}

export const parseConfig = R.compose(normalizeConfig, fromJson);

/**
 * Add photo to .photasa.json
 *
 * @param photo path of photo
 * @returns path of .photasa.json
 */
export async function addToPhotoList(photoPath: string): Promise<void> {
    return ipcRenderer.invoke("picasa:add-config", { paths: [photoPath] });
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
    const meta = await readConfig(photoPath, true);
    const photasaConfig = parseConfig(meta.data);
    const relative = toFileName(photoPath);
    const photoIndex = photasaConfig.photoList.findIndex((p) => p.path === relative);

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
        photo.isVideo = isVideo(photo.path);
        photo.path = toFileName(photo.path);
        photo.thumbnail = shortenThumbnailName(photo.thumbnail);
    });

    writeConfig(meta.dir, config);

    return config;
}
