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

// 启动大唐贞观之治
await lishiminService.startZhengguan();

logger.info("📦 挂载 App.vue 应用");
app.mount("#app");
