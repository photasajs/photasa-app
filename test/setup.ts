import { config } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { createPinia } from "pinia";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/vue";

// Create i18n instance
const i18n = createI18n({
    legacy: false,
    locale: "en",
    fallbackLocale: "en",
    messages: {
        en: {
            // Add your English translations here
        },
    },
});

// Create Pinia instance
const pinia = createPinia();

// Configure Vue Test Utils
config.global.plugins = [i18n, pinia];

// Clean up after each test
afterEach(() => {
    cleanup();
});
