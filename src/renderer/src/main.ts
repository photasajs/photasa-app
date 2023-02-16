import { createApp } from 'vue'
import App from './App.vue'

import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/antd.css'
import './assets/css/styles.less'

createApp(App).use(Antd).mount('#app')
