import assert from "node:assert/strict";
import { test } from "node:test";
import {
    RFC_0158_REQUIRED_PLATFORMS,
    assertUpdaterLatestJson,
    validateUpdaterLatestJson,
} from "../lib/updater-latest-json.mjs";

const VALID_LATEST_JSON = {
    version: "2.0.1",
    notes: "",
    pub_date: "2026-07-24T00:00:00Z",
    platforms: {
        "darwin-aarch64": {
            signature: "sig-darwin",
            url: "https://example.com/Photasa_aarch64.app.tar.gz",
        },
        "linux-x86_64": {
            signature: "sig-linux",
            url: "https://example.com/Photasa_x86_64.AppImage.tar.gz",
        },
    },
};

test("RFC 0158 required platforms match CI matrix", () => {
    assert.deepEqual(RFC_0158_REQUIRED_PLATFORMS, [
        "darwin-aarch64",
        "linux-x86_64",
    ]);
});

test("validateUpdaterLatestJson accepts darwin-aarch64 and linux-x86_64", () => {
    const result = validateUpdaterLatestJson(VALID_LATEST_JSON);
    assert.equal(result.ok, true);
    if (result.ok) {
        assert.equal(result.version, "2.0.1");
    }
});

test("validateUpdaterLatestJson rejects darwin-only latest.json", () => {
    const darwinOnly = {
        ...VALID_LATEST_JSON,
        platforms: {
            "darwin-aarch64": VALID_LATEST_JSON.platforms["darwin-aarch64"],
        },
    };
    const result = validateUpdaterLatestJson(darwinOnly);
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.ok(
            result.errors.some((error) =>
                error.includes("missing platform key: linux-x86_64"),
            ),
        );
        assert.deepEqual(result.presentPlatforms, ["darwin-aarch64"]);
    }
});

test("validateUpdaterLatestJson rejects empty url or signature", () => {
    const invalid = {
        version: "2.0.0",
        platforms: {
            "darwin-aarch64": { signature: "", url: "https://example.com/a" },
            "linux-x86_64": { signature: "sig", url: "" },
        },
    };
    const result = validateUpdaterLatestJson(invalid);
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.ok(result.errors.some((error) => error.includes("darwin-aarch64")));
        assert.ok(result.errors.some((error) => error.includes("linux-x86_64")));
    }
});

test("assertUpdaterLatestJson throws with platform summary", () => {
    assert.throws(
        () =>
            assertUpdaterLatestJson({
                version: "2.0.0",
                platforms: {
                    "darwin-aarch64": {
                        signature: "sig",
                        url: "https://example.com/a",
                    },
                },
            }),
        /missing platform key: linux-x86_64.*present: darwin-aarch64/,
    );
});
