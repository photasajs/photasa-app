import path from "path";
import { promises as fsp } from "fs";
import type { PhotasaConfig } from "@photasa/common";
import type { PhotasaLogger } from "@photasa/common";
import { StreamManifestReader } from "./StreamManifestReader";
import { createEmptyManifest, normalizeManifest } from "../support/manifest-normalizer";

export interface ManifestStoreOptions {
    reader?: StreamManifestReader;
}

export class ManifestStore {
    private readonly reader: StreamManifestReader;

    constructor(options: ManifestStoreOptions = {}) {
        this.reader = options.reader ?? new StreamManifestReader();
    }

    resolveManifestPath(targetPath: string, isFile: boolean): string {
        return isFile
            ? path.join(path.dirname(targetPath), ".photasa.json")
            : path.join(targetPath, ".photasa.json");
    }

    async ensureManifest(
        targetPath: string,
        isFile: boolean,
        logger: PhotasaLogger,
    ): Promise<string> {
        const manifestPath = this.resolveManifestPath(targetPath, isFile);
        try {
            await fsp.access(manifestPath);
        } catch {
            logger.warn(`[司簿] manifest missing, auto create: ${manifestPath}`);
            await this.writeManifest(manifestPath, createEmptyManifest(), logger);
        }
        return manifestPath;
    }

    async readManifest(configPath: string, logger: PhotasaLogger): Promise<PhotasaConfig> {
        const manifest = await this.reader.read(configPath, logger);
        return normalizeManifest(manifest, logger);
    }

    async writeManifest(
        configPath: string,
        manifest: PhotasaConfig,
        logger: PhotasaLogger,
    ): Promise<void> {
        const payload = JSON.stringify(normalizeManifest(manifest, logger), null, 4);
        await fsp.writeFile(configPath, payload, "utf8");
        logger.info(`[司簿] wrote manifest: ${configPath}`);
    }
}
