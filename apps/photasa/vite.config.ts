import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import path from "path";
import yaml from "@rollup/plugin-yaml";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [vue(), vueJsx(), yaml()],
    clearScreen: false,
    server: {
        port: 1421,
        strictPort: true,
        watch: {
            // 监听 src 目录的变化
            ignored: ["**/src-tauri/**"],
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@photasa/common": path.resolve(
                __dirname,
                "../../packages/@photasa/common/src/index.ts",
            ),
            "@photasa/common/types": path.resolve(
                __dirname,
                "../../packages/@photasa/common/src/types.ts",
            ),
            "@renderer": path.resolve(__dirname, "./src"),
        },
    },
    build: {
        outDir: "dist",
        emptyOutDir: true,
        target: "esnext",
    },
});
