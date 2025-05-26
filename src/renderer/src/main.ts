import { createApp, Plugin, watch } from "vue";
import App from "./App.vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import Antd from "ant-design-vue";
import "ant-design-vue/dist/antd.css";
import "./assets/css/styles.less";
import Bugsnag from "@bugsnag/js";
import BugsnagPluginVue from "@bugsnag/plugin-vue";
import VueVideoPlayer from "@videojs-player/vue";
import "video.js/dist/video-js.css";
import { i18n } from "./i18n/config";
import { usePreferenceStore } from "@renderer/stores/preference";

Bugsnag.start({
    apiKey: "905f9713071b76d7cd04cb3b19e4c730",
    plugins: [new BugsnagPluginVue()],
});

const bugsnagVue = Bugsnag.getPlugin("vue");
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

const app = createApp(App);
app.use(i18n);
app.use(VueVideoPlayer);
app.use(<Plugin>bugsnagVue);
app.use(pinia);
app.use(Antd);

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

Bugsnag.addMetadata("context", {
    locale: preferenceStore.locale,
    currentFolder: preferenceStore.currentFolder,
});

Bugsnag.leaveBreadcrumb("App started", {}, "state");

app.mount("#app");
