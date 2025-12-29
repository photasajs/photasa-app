import type { PhotasaConfig } from "@photasa/common";

interface CacheEntry {
    manifest: PhotasaConfig;
    timestamp: number;
}

export interface ManifestCacheOptions {
    ttlMs: number;
}

export class ManifestCache {
    private readonly store = new Map<string, CacheEntry>();

    constructor(private readonly options: ManifestCacheOptions) {}

    get(configPath: string): PhotasaConfig | undefined {
        const entry = this.store.get(configPath);
        if (!entry) return undefined;
        if (Date.now() - entry.timestamp > this.options.ttlMs) {
            this.store.delete(configPath);
            return undefined;
        }
        return this.clone(entry.manifest);
    }

    set(configPath: string, manifest: PhotasaConfig): void {
        this.store.set(configPath, {
            manifest: this.clone(manifest),
            timestamp: Date.now(),
        });
    }

    clear(): void {
        this.store.clear();
    }

    getSize(): number {
        return this.store.size;
    }

    private clone(manifest: PhotasaConfig): PhotasaConfig {
        if (typeof structuredClone === "function") {
            return structuredClone(manifest);
        }
        return JSON.parse(JSON.stringify(manifest)) as PhotasaConfig;
    }
}
