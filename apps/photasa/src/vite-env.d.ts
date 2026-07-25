/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_PHOTASA_ME_API_BASE?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
