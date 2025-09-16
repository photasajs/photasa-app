import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import svgLoader from "vite-svg-loader";

export default defineConfig({
    plugins: [vue(), svgLoader()],
    resolve: {
        alias: {
            "@main": resolve("src/main/"),
            "@renderer": resolve("src/renderer/src"),
            "@preload": resolve("src/preload/"),
            "@common": resolve("src/common/"),
            "@shared": resolve("src/shared/"),
        },
    },
    test: {
        globals: true,
        environment: "happy-dom",
        setupFiles: ["./test/setup.ts"],
        testTimeout: 3000, // 进一步减少测试超时时间到3秒
        hookTimeout: 2000, // 减少钩子超时时间到2秒
        teardownTimeout: 1000, // 减少清理超时时间到1秒
        pool: "forks", // 使用fork模式减少内存压力
        poolOptions: {
            forks: {
                singleFork: true, // 使用单个fork减少内存使用
                maxForks: 1, // 限制为单个fork
            },
        },
        maxConcurrency: 1, // 限制并发测试数量
        isolate: true, // 启用测试隔离
        passWithNoTests: true, // 允许没有测试的文件通过
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: [
                "node_modules/",
                "src/renderer/src/main.ts",
                "src/renderer/src/background.ts",
                "**/*.d.ts",
                "**/*.config.ts",
                "**/*.config.js",
                "src/renderer/src/test/**/*",
            ],
        },
        include: [
            "src/renderer/src/**/*.{test,spec}.{js,ts,jsx,tsx}",
            "src/main/**/*.{test,spec}.{js,ts,jsx,tsx}",
            "src/common/**/*.{test,spec}.{js,ts,jsx,tsx}",
            "src/shared/**/*.{test,spec}.{js,ts,jsx,tsx}",
            "src/preload/**/*.{test,spec}.{js,ts,jsx,tsx}",
        ],
        exclude: [
            // 排除内存密集型测试
            "src/main/import/__tests__/debug-time-extraction.test.ts",
            "src/main/import/__tests__/heic-date-validation.test.ts",
            "src/main/import/__tests__/heic-error-fix.test.ts",
            "src/main/import/__tests__/heic-exif-fallback.test.ts",
            "src/main/import/__tests__/heic-exif-integration.test.ts",
            "src/main/import/__tests__/heic-real-file.test.ts",
            "src/main/import/__tests__/import-date-fallback-integration.test.ts",
            "src/main/import/__tests__/processFileGroup-date-fallback.test.ts",
            "src/main/import/__tests__/real-video-files.test.ts",
            "src/main/import/metadata/extractors/__tests__/video-extractor.test.ts",
            "src/main/scan/__tests__/incremental-cache-integration.spec.ts",
            "src/main/scan/__tests__/scan-photos-integration.spec.ts",
            "src/main/scan/__tests__/scan-photos.test.ts",
            "src/main/thumbnail/__tests__/thumbnail-handler.spec.ts",
            "src/main/thumbnail/__tests__/thumbnail-utils.test.ts",
            "src/renderer/src/components/__tests__/ImportPhotos.test.ts",
            "src/renderer/src/components/__tests__/ImportPhotos.edge-cases.test.ts",
            "src/renderer/src/stores/__tests__/preference.spec.ts",
            "src/renderer/src/utils/__tests__/api.spec.ts",
            "src/shared/__tests__/path-util.spec.ts",
            "src/common/__tests__/logger.spec.ts",
            "src/preload/__tests__/file-config.spec.ts",
            "src/main/scan/__tests__/scan-helpers-fix.test.ts",
            "src/main/scan/__tests__/scan-integration-fix.test.ts",
            "src/main/import/__tests__/batch-processor.test.ts",
            "src/main/import/__tests__/import-service.test.ts",
            "src/main/import/__tests__/unified-exif-extraction.test.ts",
            "src/main/import/file-groups/__tests__/detector.test.ts",
            "src/main/import/metadata/parsers/__tests__/date-parser.test.ts",
            "src/main/import/metadata/parsers/__tests__/camera-parser.test.ts",
            "src/main/import/__tests__/exif-data-structure-debug.test.ts",
            "src/main/import/__tests__/rename-strategy-fix.test.ts",
            "src/main/wasm/__tests__/heif-module.test.ts",
            "src/main/scan/__tests__/scan-strategy.spec.ts",
            "src/main/scan/__tests__/scan-strategy-fix.test.ts",
            "src/main/scan/__tests__/scan-helpers.spec.ts",
            "src/main/scan/__tests__/scan-cleanup.spec.ts",
            "src/main/scan/__tests__/scan-worker.test.ts",
            "src/main/scan/__tests__/folder-cache-manager.spec.ts",
            "src/main/update/__tests__/update-service.test.ts",
            "src/main/watch/__tests__/watch-service.integration.test.ts",
            "src/main/thumbnail/__tests__/video-rotation.test.ts",
            "src/main/__tests__/check-photasa-config.test.ts",
            "src/renderer/src/components/__tests__/ImportProgressModal.test.ts",
            "src/renderer/src/components/ui/__tests__/BaseNotification.spec.ts",
            "src/renderer/src/components/ui/__tests__/BaseButton.test.ts",
            "src/renderer/src/components/ui/__tests__/BaseMenuItem.test.ts",
            "src/renderer/src/components/ui/__tests__/NotificationContainer.spec.ts",
            "src/renderer/src/components/ui/__tests__/BaseContextMenu.test.ts",
            "src/renderer/src/components/ui/__tests__/BaseSelect.test.ts",
            "src/renderer/src/components/ui/__tests__/BaseTree.test.ts",
            "src/renderer/src/components/queue-monitoring/__tests__/BaseMetricsCard.spec.ts",
            "src/renderer/src/components/wizard/__tests__/useWizard.test.ts",
            "src/renderer/src/composables/__tests__/useDropdownManager.test.ts",
            "src/renderer/src/utils/__tests__/import-wizard-helpers.test.ts",
            "src/renderer/src/utils/__tests__/scan-priority.spec.ts",
            "src/renderer/src/components/LightBox/utils/__tests__/index.spec.ts",
            "src/renderer/src/components/__tests__/ImageListHelper.test.ts",
            "src/renderer/src/stores/__tests__/preference-scan-fix.test.ts",
            "src/renderer/src/services/__tests__/queue-monitoring-service.spec.ts",
            "src/renderer/src/__tests__/App.spec.ts",
            "src/renderer/src/__tests__/AppHelper.spec.ts",
            "src/renderer/src/common/__tests__/image.spec.ts",
            "src/common/__tests__/error-handler.spec.ts",
            "src/preload/__tests__/index.spec.ts",
            "src/preload/__tests__/image-helper-path.spec.ts",
        ],
        server: {
            deps: {
                inline: [/@vue/, /@vueuse/, /@ant-design/, /radash/],
            },
        },
        environmentOptions: {
            happyDOM: {
                settings: {
                    navigator: {
                        userAgent: "node",
                    },
                },
            },
        },
    },
});
