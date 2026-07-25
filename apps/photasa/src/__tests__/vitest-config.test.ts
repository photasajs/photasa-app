import { describe, expect, it } from "vitest";

import vitestConfig from "../../vitest.config";

describe("RFC 0154 Vitest collection gate", () => {
    it("collects both test.ts and spec.ts suites", () => {
        expect(vitestConfig.test?.include).toEqual(["src/**/*.test.ts", "src/**/*.spec.ts"]);
    });
});
