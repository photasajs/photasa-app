import { createReadStream } from "fs";
import { promises as fsp } from "fs";
import Assembler from "stream-json/Assembler";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import type { PhotasaConfig } from "@photasa/common";
import type { PhotasaLogger } from "@photasa/common";
import { createEmptyManifest, normalizeManifest } from "../support/manifest-normalizer";

export class StreamManifestReader {
    constructor(private readonly logger?: PhotasaLogger) {}

    async read(filePath: string, logger?: PhotasaLogger): Promise<PhotasaConfig> {
        const effectiveLogger = logger ?? this.logger;

        try {
            await fsp.access(filePath);
        } catch {
            effectiveLogger?.warn?.(`[司簿] config not found, return empty: ${filePath}`);
            return createEmptyManifest();
        }

        return new Promise((resolve, reject) => {
            const assembler = new Assembler();
            const pipeline = chain([createReadStream(filePath, { encoding: "utf8" }), parser()]);

            pipeline.on("data", (chunk) => {
                try {
                    assembler.consume(chunk);
                } catch (error) {
                    pipeline.destroy(error as Error);
                }
            });

            pipeline.on("error", (error) => {
                effectiveLogger?.error?.(`[司簿] failed to stream config: ${filePath}`, error);
                reject(error);
            });

            pipeline.on("end", () => {
                try {
                    const raw = (assembler.current as Partial<PhotasaConfig>) ?? {};
                    const normalized = normalizeManifest(raw, effectiveLogger);
                    resolve(normalized);
                } catch (error) {
                    effectiveLogger?.error?.(
                        `[司簿] failed to normalize config: ${filePath}`,
                        error,
                    );
                    reject(error);
                }
            });
        });
    }
}
