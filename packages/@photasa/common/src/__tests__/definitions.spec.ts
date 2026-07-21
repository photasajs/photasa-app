import { describe, it, expect } from "vitest";
import config from "../config";
import * as constants from "../constants";

describe("Definition files", () => {
    describe("config.ts", () => {
        it("should export configuration object", () => {
            expect(config).toBeDefined();
            expect(Array.isArray(config.acceptedRawExtensions)).toBe(true);
            expect(Array.isArray(config.acceptedHeicExtensions)).toBe(true);
            expect(Array.isArray(config.acceptedNonRawExtensions)).toBe(true);
            expect(Array.isArray(config.acceptedAiExtensions)).toBe(true);
        });
    });

    describe("constants.ts", () => {
        it("should export constants", () => {
            expect(constants).toBeDefined();
            // Iterate over all exports to ensure they are accessible
            Object.values(constants).forEach((value) => {
                expect(value).toBeDefined();
            });

            // Check specific known constants
            expect(constants.DirectoryStatus).toBeDefined();
            expect(constants.ImportEvents).toBeDefined();
            expect(constants.ColorMap).toBeDefined();
            expect(constants.DuplicateStrategies).toBeDefined();
        });
    });
});
