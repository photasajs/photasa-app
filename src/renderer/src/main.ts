import { createApp, watch } from "vue";
import App from "./App.vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import "./assets/css/styles.less";
import "./assets/css/tailwind.css";
import VueVideoPlayer from "@videojs-player/vue";
import "video.js/dist/video-js.css";
import { i18n } from "./i18n/config";
import { usePreferenceStore } from "@renderer/stores/preference";
import { useStatusBarStore } from "@renderer/stores/statusBar";
import { FindPhotoServiceIpc } from "@renderer/services/find-photo-service";
import { FindPhotoServiceKey } from "@renderer/interface/find-photo-service.interface";

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

const app = createApp(App);
app.use(i18n);
app.use(VueVideoPlayer);
app.use(pinia);

// provide FindPhotoServiceIpc 实例
app.provide(FindPhotoServiceKey, new FindPhotoServiceIpc());

/**
 * 初始化偏好设置
 */
const preferenceStore = usePreferenceStore();
const locale = preferenceStore.locale as
    | "en-US"
    | "zh-CN"
    | "ja-JP"
    | "ko-KR"
    | "fr-FR"
    | "de-DE"
    | "es-ES";
(i18n.global.locale as unknown as import("vue").Ref<string>).value = locale;
document.querySelector("html")?.setAttribute("lang", locale);

// Watch for changes to keep i18n in sync with Pinia
watch(
    () => preferenceStore.locale,
    (newLocale) => {
        (i18n.global.locale as unknown as import("vue").Ref<string>).value = newLocale;
        document.querySelector("html")?.setAttribute("lang", newLocale);
    },
);

const statusBarStore = useStatusBarStore();

// TODO: move to preload api instead
if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.on("notify:status", (_event, payload) => {
        statusBarStore.update(payload);
    });
}

app.mount("#app");
