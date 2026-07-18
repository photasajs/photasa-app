import { createApp } from "vue";
import App from "./App.vue";
// 导入 API 适配层
import "./api/adapter";

const app = createApp(App);
app.mount("#app");
