import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("deploy:photasa builds and installs local Prod app", () => {
    const rootPackageJson = JSON.parse(
        readFileSync(new URL("../../package.json", import.meta.url)),
    );
    const photasaPackageJson = JSON.parse(
        readFileSync(
            new URL("../../apps/photasa/package.json", import.meta.url),
        ),
    );

    assert.equal(
        rootPackageJson.scripts["deploy:photasa"],
        'pnpm --filter @photasa/photasa run build:local && ditto "target/release/bundle/macos/Photasa.app" "/Applications/Photasa.app" && codesign --force --deep --sign - "/Applications/Photasa.app" && codesign --verify --deep --strict "/Applications/Photasa.app"',
    );
    assert.equal(
        photasaPackageJson.scripts["build:local"],
        'tauri build -c "{\\"bundle\\":{\\"createUpdaterArtifacts\\":false}}"',
    );
});
