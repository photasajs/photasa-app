// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import { babel } from "@rollup/plugin-babel";
import { comlink } from "vite-plugin-comlink";
import svgLoader from "vite-svg-loader";
import yaml from "@rollup/plugin-yaml";
/**
 * Check if the mode is development or debug
 * @param mode - The mode to check
 * @returns
 */
const isDev = (mode) => mode === "development" || process.env.DEBUG === "true";

/**
 * Check if the mode is production
 * @param mode - The mode to check
 * @returns
 */
const isProd = (mode) => mode === "production";

export default defineConfig(({ mode }) => ({
    main: {
        plugins: [
            externalizeDepsPlugin({
                exclude: ["@photasa/common"],
            }),
        ],
        resolve: {
            alias: {
                "@main": resolve("src/main/"),
                "@shared": resolve("src/shared/"),
                "@maliang": resolve("src/engines/maliang/"),
                "@shunfenger": resolve("src/engines/shunfenger/"),
                "@sibu": resolve("src/engines/sibu/"),
                "@tianshu": resolve("src/engines/tianshu/"),
                "@qianliyan": resolve("src/engines/qianliyan/"),
                "@engines": resolve("src/engines/"),
            },
        },
        build: {
            sourcemap: isDev(mode),
            minify: isProd(mode),
        },
    },
    preload: {
        plugins: [
            externalizeDepsPlugin({
                exclude: ["@photasa/common"],
            }),
            babel({ babelHelpers: "bundled" }),
        ],
        resolve: {
            alias: {
                "@renderer": resolve("src/renderer/src"),
                "@preload": resolve("src/preload/"),
                "@shared": resolve("src/shared/"),
            },
        },
        build: {
            sourcemap: isDev(mode),
            minify: isProd(mode),
            rollupOptions: {
                input: {
                    index: resolve("src/preload/index.ts"),
                    "splash-preload": resolve("src/preload/splash-preload.ts"),
                },
            },
        },
    },
    renderer: {
        resolve: {
            alias: {
                "@renderer": resolve("src/renderer/src"),
                "@preload": resolve("src/preload/"),
                // 注意：@shared 不应该在渲染进程中使用，因为包含 Node.js 依赖
            },
        },
        plugins: [vue(), vueJsx(), comlink(), svgLoader(), yaml()],
        css: {
            preprocessorOptions: {
                less: {
                    javascriptEnabled: true,
                },
            },
        },
        build: {
            sourcemap: isDev(mode),
            minify: isProd(mode),
        },
    },
}));
