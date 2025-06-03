/// <reference types="vite/client" />
/// <reference types="vite-plugin-comlink/client" />

declare module "*.vue" {
    import type { DefineComponent } from "vue";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
    const component: DefineComponent<{}, {}, any>;
    export default component;
}

import type { ElectronAPI } from "@electron-toolkit/preload";
import type { API } from "@preload/types";

declare global {
    interface Window {
        electron: ElectronAPI;
        api: API;
        __heic2any__worker: Worker;
    }
}
