import "./assets/css/styles.less";
import "./assets/css/tailwind.css";
import "video.js/dist/video-js.css";

import { createApp } from "vue";
import App from "./App.vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";

import VueVideoPlayer from "@videojs-player/vue";
import { i18n } from "./i18n/config";
import { installVueErrorHandler } from "./services/telemetry/posthog-client";

import { LishiminService, LISSHIMING_TOKEN } from "./services";
import { applyPersistedThemeBootstrap } from "./bootstrap/apply-persisted-theme";
import { installDisableBrowserContextMenu } from "./bootstrap/disable-browser-context-menu";
import { getThemeManager } from "./services/chusuiliang/theme-manage";
import { usePreferenceStore } from "./stores/preference";
import { isTauri } from "./api/env";
import { loggers } from "@photasa/common";
const logger = loggers.app;

// 模块加载后再次同步（与 index.html 阻塞脚本互补；initializeDepartments 前首屏已着色）
applyPersistedThemeBootstrap();
installDisableBrowserContextMenu();

logger.info("📦 开天辟地");
const app = createApp(App);
/**
 * 创建 Pinia 实例
 */
logger.info("📦 创建 Pinia 实例");
const pinia = createPinia();
logger.info("📦 启动 Pinia 持久化插件");
pinia.use(piniaPluginPersistedstate);
logger.info("📦 挂载 i18n");
app.use(i18n);
logger.info("📦 挂载 VueVideoPlayer");
app.use(VueVideoPlayer);
logger.info("📦 挂载 pinia");
app.use(pinia);

installVueErrorHandler(app);

// 大唐李世民登基
const lishiminService = new LishiminService(app);
app.provide(LISSHIMING_TOKEN, lishiminService);

// 先同步就位；恢复 appState / 扫描队列后再挂载，避免空树覆盖磁盘或 SKIP 扫描竞态
lishiminService.prepareCourt();

await lishiminService.initializeDepartments();

logger.info("📦 预应用用户主题（首屏 loading 与偏好一致）");
const themeManager = getThemeManager();
await themeManager.loadBuiltInThemes();
const preferenceStore = usePreferenceStore();
const savedThemeId = preferenceStore.ui.theme;
if (savedThemeId) {
    try {
        await themeManager.applyTheme(savedThemeId);
        logger.info("📦 启动主题已应用:", savedThemeId);
    } catch (error) {
        logger.warn("📦 启动主题预应用失败，沿用默认样式", error);
    }
}

logger.info("📦 挂载 App.vue 应用");
app.mount("#app");

// RFC 0101：Vue 首帧挂载后关 Splash、显示主窗（勿在 Rust setup 过早关闭）
if (isTauri()) {
    try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("close_splashscreen");
        logger.info("📦 启动画面已关闭");
    } catch (error) {
        logger.warn("📦 关闭启动画面失败", error);
    }
}
