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
            name: "PhotasaCommon",
            fileName: (format) => `index.${format === "es" ? "mjs" : "cjs"}`,
            formats: ["es", "cjs"],
        },
        rollupOptions: {
            external: ["electron", "log4js", "uuid", "lodash", "@systembug/diting"],
        },
        sourcemap: true,
        emptyOutDir: true,
    },
});
