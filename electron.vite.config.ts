import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import vue from "@vitejs/plugin-vue";
import { babel } from "@rollup/plugin-babel";
import { comlink } from "vite-plugin-comlink";

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
    },
    preload: {
        plugins: [externalizeDepsPlugin(), babel({ babelHelpers: "bundled" })],
    },
    renderer: {
        resolve: {
            alias: {
                "@renderer": resolve("src/renderer/src"),
                "@preload": resolve("src/preload/"),
                "@common": resolve("src/common/"),
            },
        },
        plugins: [vue(), comlink()],
        css: {
            preprocessorOptions: {
                less: {
                    javascriptEnabled: true,
                },
            },
        },
    },
});
