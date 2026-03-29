import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import path from "path";

export default defineConfig({
    plugins: [
        dts({
            entryRoot: "src",
            tsconfigPath: path.join(__dirname, "tsconfig.json"),
        }),
    ],
    build: {
        lib: {
            entry: path.resolve(__dirname, "src/index.ts"),
            name: "PhotasaScan",
            fileName: (format) => `index.${format === "es" ? "mjs" : "cjs"}`,
            formats: ["es", "cjs"],
        },
        rollupOptions: {
            external: [
                "fs",
                "fs/promises",
                "path",
                "crypto",
                "os",
                "stream",
                "events",
                "util",
                "worker_threads",
                "@photasa/common",
                "@photasa/config-core",
                "fs-extra",
                "klaw",
                "is-image",
                "is-video",
                "rxjs",
                "rxjs/operators",
            ],
        },
        outDir: "dist",
        sourcemap: true,
        target: "esnext",
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
});
