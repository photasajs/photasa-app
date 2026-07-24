/* eslint-env node */
require("@rushstack/eslint-patch/modern-module-resolution");

const legacyImportPaths = [
    "@renderer/utils/api",
    "@renderer/api/legacy-api",
    "@renderer/ipc/api-access",
];

const legacyImportDebtFiles = [
    "src/ipc/api-access.ts",
    "src/composables/useUpdateListener.ts",
    "src/stores/preference.ts",
    "src/utils/api.ts",
    "src/utils/api-path.ts",
    "src/utils/file-handler.ts",
    "src/utils/scan-folder.ts",
    "src/services/folderSelectionService.ts",
    "src/components/ImageList.vue",
    "src/components/ImageListHelper.ts",
    "src/components/ImportPhotos.vue",
    "src/components/ImportProgressModal.vue",
    "src/components/LogConsole.vue",
    "src/components/TitlebarWinLinux.vue",
    "src/components/import/ImportHistory.vue",
    "src/components/settings/GeneralSettings.vue",
    "src/components/settings/ImportSettings.vue",
    "src/components/settings/UpdateSettings.vue",
];

const tauriTransportDebtFiles = [
    "src/main.ts",
    "src/api/config.adapter.ts",
    "src/api/import.adapter.ts",
    "src/api/legacy-api.ts",
    "src/api/scan.adapter.ts",
    "src/api/shell.adapter.ts",
    "src/api/thumbnail.adapter.ts",
    "src/api/window.adapter.ts",
    "src/stores/import-session.ts",
    "src/services/yuantiangang/yuantiangang.ts",
    "src/services/yuantiangang/**/*.ts",
];

const legacyStaticImportRule = [
    "error",
    {
        paths: legacyImportPaths.map((name) => ({
            name,
            message: "RFC 0154: use responsible Zhenguan service, not legacy API.",
        })),
    },
];

const tauriStaticImportRule = [
    "error",
    {
        paths: [
            {
                name: "@tauri-apps/api/core",
                message: "RFC 0154: business transport belongs to YuanTianGang.",
            },
            {
                name: "@tauri-apps/api/event",
                message: "RFC 0154: business event transport belongs to YuanTianGang.",
            },
        ],
        patterns: [
            {
                group: ["@tauri-apps/plugin-*"],
                message: "RFC 0154: Tauri plugins cannot bypass YuanTianGang.",
            },
        ],
    },
];

const legacyDynamicImportRule = [
    "error",
    {
        selector:
            "ImportExpression[source.value=/^@renderer\\x2F(utils\\x2Fapi|api\\x2Flegacy-api|ipc\\x2Fapi-access)$/]",
        message: "RFC 0154: dynamic import cannot bypass Zhenguan service boundary.",
    },
];

const tauriCoreDynamicRestriction = {
    selector: "ImportExpression[source.value='@tauri-apps/api/core']",
    message: "RFC 0154: dynamic Tauri transport belongs to YuanTianGang.",
};

const tauriEventDynamicRestriction = {
    selector: "ImportExpression[source.value='@tauri-apps/api/event']",
    message: "RFC 0154: dynamic Tauri event transport belongs to YuanTianGang.",
};

const tauriPluginDynamicRestriction = {
    selector: "ImportExpression[source.value=/^@tauri-apps\\x2Fplugin-/]",
    message: "RFC 0154: dynamic Tauri plugin cannot bypass YuanTianGang.",
};

const tauriDynamicImportRule = [
    "error",
    tauriCoreDynamicRestriction,
    tauriEventDynamicRestriction,
    tauriPluginDynamicRestriction,
];

const reviewedCoreStaticImportRule = [
    "error",
    {
        paths: [
            ...legacyStaticImportRule[1].paths,
            {
                name: "@tauri-apps/api/core",
                importNames: ["invoke"],
                message: "RFC 0154: business invoke belongs to YuanTianGang.",
            },
            tauriStaticImportRule[1].paths[1],
        ],
        patterns: tauriStaticImportRule[1].patterns,
    },
];

const reviewedCoreDynamicImportRule = [
    "error",
    ...legacyDynamicImportRule.slice(1),
    tauriEventDynamicRestriction,
    tauriPluginDynamicRestriction,
];

const reviewedStaticCoreOnlyDynamicImportRule = [
    "error",
    ...legacyDynamicImportRule.slice(1),
    ...tauriDynamicImportRule.slice(1),
];

module.exports = {
    root: true,
    env: {
        node: true,
    },
    extends: [
        "plugin:vue/vue3-essential",
        "@vue/typescript/recommended",
        "plugin:prettier/recommended",
    ],
    parserOptions: {
        ecmaVersion: 2020,
    },
    plugins: ["prettier"],
    rules: {
        "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
        "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
        "prettier/prettier": "error",
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/no-unused-vars": [
            "warn",
            {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
            },
        ],
        "no-restricted-imports": [
            "error",
            {
                paths: [...legacyStaticImportRule[1].paths, ...tauriStaticImportRule[1].paths],
                patterns: tauriStaticImportRule[1].patterns,
            },
        ],
        "no-restricted-syntax": [
            "error",
            ...legacyDynamicImportRule.slice(1),
            ...tauriDynamicImportRule.slice(1),
        ],
    },
    overrides: [
        {
            files: legacyImportDebtFiles,
            rules: {
                "no-restricted-imports": tauriStaticImportRule,
                "no-restricted-syntax": tauriDynamicImportRule,
            },
        },
        {
            files: [...tauriTransportDebtFiles],
            rules: {
                "no-restricted-imports": legacyStaticImportRule,
                "no-restricted-syntax": legacyDynamicImportRule,
            },
        },
        {
            files: ["src/api/env.ts"],
            rules: {
                "no-restricted-imports": reviewedCoreStaticImportRule,
                "no-restricted-syntax": reviewedCoreDynamicImportRule,
            },
        },
        {
            files: ["src/utils/media-url.ts"],
            rules: {
                "no-restricted-imports": reviewedCoreStaticImportRule,
                "no-restricted-syntax": reviewedStaticCoreOnlyDynamicImportRule,
            },
        },
        {
            files: [
                "src/services/yuantiangang/yuantiangang.ts",
                "src/services/yuantiangang/**/*.ts",
            ],
            rules: {
                "no-restricted-imports": "off",
                "no-restricted-syntax": "off",
            },
        },
        {
            files: ["src/App.vue"],
            rules: {
                "no-restricted-imports": "off",
                "no-restricted-syntax": "off",
            },
        },
        {
            files: ["src/**/*.test.ts", "src/**/*.spec.ts"],
            rules: {
                "no-restricted-imports": "off",
                "no-restricted-syntax": "off",
            },
        },
    ],
};
