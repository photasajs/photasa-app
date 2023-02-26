import { createApp, Plugin } from "vue";
import App from "./App.vue";
import { createPinia } from "pinia";
//import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import Antd from "ant-design-vue";
import "ant-design-vue/dist/antd.css";
import "./assets/css/styles.less";
import Bugsnag from "@bugsnag/js";
import BugsnagPluginVue from "@bugsnag/plugin-vue";

Bugsnag.start({
    apiKey: "905f9713071b76d7cd04cb3b19e4c730",
    plugins: [new BugsnagPluginVue()],
});

const bugsnagVue = Bugsnag.getPlugin("vue");
const pinia = createPinia();
//pinia.use(piniaPluginPersistedstate);

createApp(App)
    .use(<Plugin>bugsnagVue)
    .use(pinia)
    .use(Antd)
    .mount("#app");
