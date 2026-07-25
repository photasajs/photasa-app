import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
    plugins: [
        vue(),
        dts({
            entryRoot: "src",
            outDir: "dist",
            tsconfigPath: resolve(__dirname, "tsconfig.json"),
        }),
    ],
    build: {
        lib: {
            entry: resolve(__dirname, "src/index.ts"),
            name: "PhotasaBaseTree",
            fileName: () => "index.mjs",
            formats: ["es"],
        },
        rollupOptions: {
            external: ["vue", "@tanstack/vue-virtual"],
        },
        sourcemap: true,
        emptyOutDir: true,
    },
});
