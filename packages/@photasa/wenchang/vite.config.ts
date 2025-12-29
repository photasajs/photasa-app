import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
    plugins: [
        dts({
            entryRoot: "src",
            outDir: "dist",
            rollupTypes: true,
            strictOutput: true,
        }),
    ],
    build: {
        lib: {
            entry: resolve(__dirname, "src/index.ts"),
            name: "PhotasaWenchang",
            fileName: (format) => `index.${format === "es" ? "mjs" : "cjs"}`,
            formats: ["es", "cjs"],
        },
        rollupOptions: {
            external: ["electron", "fs-extra", "path", "events", "fs/promises", "@photasa/common"],
        },
        sourcemap: true,
        emptyOutDir: true,
    },
});
