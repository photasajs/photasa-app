// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import { babel } from "@rollup/plugin-babel";
import { comlink } from "vite-plugin-comlink";
import svgLoader from "vite-svg-loader";

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        resolve: {
            alias: {
                "@common": resolve("src/common/"),
                "@shared": resolve("src/shared/"),
            },
        },
    },
    preload: {
        plugins: [externalizeDepsPlugin(), babel({ babelHelpers: "bundled" })],
        resolve: {
            alias: {
                "@renderer": resolve("src/renderer/src"),
                "@preload": resolve("src/preload/"),
                "@common": resolve("src/common/"),
                "@shared": resolve("src/shared/"),
            },
        },
    },
    renderer: {
        resolve: {
            alias: {
                "@renderer": resolve("src/renderer/src"),
                "@preload": resolve("src/preload/"),
                "@common": resolve("src/common/"),
                "@shared": resolve("src/shared/"),
            },
        },
        plugins: [vue(), vueJsx(), comlink(), svgLoader()],
        css: {
            preprocessorOptions: {
                less: {
                    javascriptEnabled: true,
                },
            },
        },
    },
});
