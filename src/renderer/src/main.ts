import { createApp, Plugin } from "vue";
import App from "./App.vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import Antd from "ant-design-vue";
import "ant-design-vue/dist/antd.css";
import "./assets/css/styles.less";
import Bugsnag from "@bugsnag/js";
import BugsnagPluginVue from "@bugsnag/plugin-vue";
import { createI18n } from "vue-i18n";
import enUS from "./locales/en-US.json";
import zhCN from "./locales/zh-CN.json";
import jaJP from "./locales/ja-JP.json";
import VueVideoPlayer from "@videojs-player/vue";
import "video.js/dist/video-js.css";

Bugsnag.start({
    apiKey: "905f9713071b76d7cd04cb3b19e4c730",
    plugins: [new BugsnagPluginVue()],
});

// Type-define 'en-US' as the master schema for the resource
type MessageSchema = typeof zhCN | typeof enUS | typeof jaJP;

const i18n = createI18n<[MessageSchema], "zh-CN" | "en-US" | "ja-JP">({
    locale: "zh-CN", //
    legacy: false,
    fallbackLocale: "en",
    globalInjection: true,
    messages: {
        "en-US": enUS,
        "zh-CN": zhCN,
        "ja-JP": jaJP,
    },
});

const bugsnagVue = Bugsnag.getPlugin("vue");
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

createApp(App)
    .use(i18n)
    .use(VueVideoPlayer)
    .use(<Plugin>bugsnagVue)
    .use(pinia)
    .use(Antd)
    .mount("#app");
