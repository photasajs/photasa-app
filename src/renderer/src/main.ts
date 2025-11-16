import "./assets/css/styles.less";
import "./assets/css/tailwind.css";
import "video.js/dist/video-js.css";

import { createApp } from "vue";
import App from "./App.vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";

import VueVideoPlayer from "@videojs-player/vue";
import { i18n } from "./i18n/config";

import { useStatusBarStore } from "@renderer/stores/statusBar";

import { FindPhotoServiceIpc } from "@renderer/services/find-photo-service";
import { FindPhotoServiceKey } from "@renderer/interfaces/find-photo-service.interface";
import { globalLogInterceptor } from "@common/logger";

import { LisshimingService, LISSHIMING_TOKEN } from "./services";
import { loggers } from "@common/logger";

const logger = loggers.lishimin;

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

logger.info("📦 提供 Legacy FindPhotoServiceIpc 实例");
const findPhotoServiceIpc = new FindPhotoServiceIpc();
app.provide(FindPhotoServiceKey, findPhotoServiceIpc);

// 大唐李世民登基
const lisshimingService = new LisshimingService(app);
app.provide(LISSHIMING_TOKEN, lisshimingService);

// 初始化 renderer 日志拦截器 - 直接发送到 log viewer
globalLogInterceptor.activate();

// 启动大唐贞观之治
await lisshimingService.startZhengguan();

// 初始化状态栏
const statusBarStore = useStatusBarStore();
// TODO: move to preload api instead
if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.on("notify:status", (_event, payload) => {
        statusBarStore.update(payload);
    });
}

logger.info("📦 挂载 App.vue 应用");
app.mount("#app");
