import "./assets/css/styles.less";
import "./assets/css/tailwind.css";
import "video.js/dist/video-js.css";

import { createApp } from "vue";
import App from "./App.vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";

import VueVideoPlayer from "@videojs-player/vue";
import { i18n } from "./i18n/config";

import { LishiminService, LISSHIMING_TOKEN } from "./services";
import { loggers } from "@photasa/common";
import { isTauri } from "./api/env";

// 导入 API 适配层
import "./api/adapter";

const logger = loggers.app;

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

// 大唐李世民登基
const lishiminService = new LishiminService(app);
app.provide(LISSHIMING_TOKEN, lishiminService);

// 先同步就位再挂载，避免在 mount 之前被天枢/奏折 IPC 长时间阻塞（否则 Splash 永不关）
lishiminService.prepareCourt();

logger.info("📦 挂载 App.vue 应用");
app.mount("#app");

// 壳层已挂载：立即关闭 Splash、显示主窗，不等待 onMounted 内异步链（RFC 0101）
if (isTauri()) {
    import("@tauri-apps/api/core")
        .then(({ invoke }) => invoke("close_splashscreen"))
        .catch((err) => logger.warn("告示：关闭启动画面未果", err));
}

if (isTauri()) {
    const { tianshuAdapter } = await import("./api/tianshu.adapter");
    await tianshuAdapter.waitUntilReady();
}
await lishiminService.initializeDepartments();
