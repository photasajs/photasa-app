import fs from "fs-extra";
import path from "path";
import type { PhotasaConfig } from "./index.d";
import * as R from "ramda";
import { buildThumbnailPath } from "./image-helper";

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
    const data = JSON.stringify(photoConfig, null, 4);
    await fs.writeFile(configPath, data);
}

function fromJson(data: string): PhotasaConfig {
    return <PhotasaConfig>JSON.parse(data);
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
 */
export async function updatePhotoList(photoPath: string): Promise<PhotasaConfig> {
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
    return photasaConfig;
}

export async function getPhotasaConfig(folder: string): Promise<PhotasaConfig> {
    const meta = await readConfig(folder, false);
    return parseConfig(meta.data);
}
