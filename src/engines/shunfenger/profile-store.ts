import fs from "fs-extra";
import path from "path";
import { loggers } from "@common/logger";
import type { WatchProfile } from "./types";

const logger = loggers.watch;

export class ProfileStore {
    private readonly storagePath: string;
    private profiles = new Map<string, WatchProfile>();

    constructor(storagePath: string) {
        this.storagePath = storagePath;
    }

    async initialize(): Promise<void> {
        try {
            await fs.ensureDir(path.dirname(this.storagePath));
            if (!(await fs.pathExists(this.storagePath))) {
                await fs.writeJSON(this.storagePath, []);
            }
            const data = await fs.readJSON(this.storagePath);
            if (Array.isArray(data)) {
                data.forEach((profile: WatchProfile) => {
                    this.profiles.set(profile.id, profile);
                });
            }
        } catch (error) {
            logger.error("[ProfileStore] Failed to initialize", error);
        }
    }

    list(): WatchProfile[] {
        return Array.from(this.profiles.values());
    }

    get(id: string): WatchProfile | undefined {
        return this.profiles.get(id);
    }

    async upsert(profile: WatchProfile): Promise<void> {
        this.profiles.set(profile.id, profile);
        await this.persist();
    }

    async remove(id: string): Promise<void> {
        this.profiles.delete(id);
        await this.persist();
    }

    private async persist(): Promise<void> {
        try {
            await fs.writeJSON(this.storagePath, this.list(), { spaces: 2 });
        } catch (error) {
            logger.error("[ProfileStore] Failed to persist profiles", error);
        }
    }
}
