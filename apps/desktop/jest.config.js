/**
 * Jest configuration for main process tests
 * 只用于main进程测试，不涉及renderer测试
 */

module.exports = {
    // 测试环境
    testEnvironment: "node",

    // 测试文件匹配模式 - 匹配main目录下的测试
    testMatch: [
        "<rootDir>/src/main/**/__tests__/**/*.spec.ts",
    ],

    // TypeScript支持
    preset: "ts-jest",

    // TypeScript配置
    transform: {
        "^.+\\.ts$": [
            "ts-jest",
            {
                useESM: false,
                tsconfig: {
                    module: "commonjs",
                    target: "es2020",
                    lib: ["es2020", "dom"],
                    allowSyntheticDefaultImports: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                    strict: false,
                    noImplicitAny: false,
                    noImplicitReturns: false,
                    noImplicitThis: false,
                    noUnusedLocals: false,
                    noUnusedParameters: false,
                    types: ["node", "jest", "@jest/globals"],
                    baseUrl: ".",
                    paths: {
                        "@common/*": ["./src/common/*"],
                        "@main/*": ["./src/main/*"],
                        "@renderer/*": ["./src/renderer/*"],
                        "@shared/*": ["./src/shared/*"],
                        "@engines/common/*": ["./src/main/engines/common/*"],
                        "@engines/*": ["./src/main/engines/*"],
                        "@zouwu-wf/workflow/runtime/*": [
                            "../../packages/@zouwu-wf/workflow/src/runtime/*",
                        ],
                        "@zouwu-wf/workflow/runtime": [
                            "../../packages/@zouwu-wf/workflow/src/runtime/index",
                        ],
                        "@zouwu-wf/workflow/*": ["../../packages/@zouwu-wf/workflow/src/*"],
                        "@zouwu-wf/workflow": ["../../packages/@zouwu-wf/workflow/src/index"],
                        "@photasa/common": ["../../packages/common/src/index"],
                        "@photasa/common/*": ["../../packages/common/src/*"],
                        "@photasa/tianshu": ["../../packages/@photasa/tianshu/src/index"],
                        "@photasa/tianshu/*": ["../../packages/@photasa/tianshu/src/*"],
                    },
                    typeRoots: ["node_modules/@types", "test"],
                },
            },
        ],
    },

    // 模块解析 - 使用正确的Jest属性名
    moduleNameMapper: {
        "^@common/(.*)$": "<rootDir>/src/common/$1",
        "^@common$": "<rootDir>/src/common/index",
        "^@main/(.*)$": "<rootDir>/src/main/$1",
        "^@renderer/(.*)$": "<rootDir>/src/renderer/$1",
        "^@shared/(.*)$": "<rootDir>/src/shared/$1",
        "^@tianshu$": "<rootDir>/src/main/engines/tianshu/index",
        "^@tianshu/(.*)$": "<rootDir>/src/main/engines/tianshu/$1",
        "^@engines/common/(.*)$": "<rootDir>/src/main/engines/common/$1",
        "^@engines/(.*)$": "<rootDir>/src/main/engines/$1",
        // Map ?nodeWorker query parameter to the actual module
        "^(.+)\\?nodeWorker$": "$1",

        // Workspace packages mapping
        "^@zouwu-wf/workflow/runtime/(.*)$":
            "<rootDir>/../../packages/@zouwu-wf/workflow/src/runtime/$1",
        "^@zouwu-wf/workflow/runtime$":
            "<rootDir>/../../packages/@zouwu-wf/workflow/src/runtime/index",
        "^@zouwu-wf/workflow/(.*)$": "<rootDir>/../../packages/@zouwu-wf/workflow/src/$1",
        "^@zouwu-wf/workflow$": "<rootDir>/../../packages/@zouwu-wf/workflow/src/index",
    },

    // 测试超时设置
    testTimeout: 15000,

    // 覆盖率设置
    collectCoverageFrom: [
        "src/main/**/*.ts",
        "!src/main/**/*.d.ts",
        "!src/main/**/__tests__/**",
    ],

    // 设置文件
    setupFilesAfterEnv: ["<rootDir>/test/setup.main.jest.ts"],

    // Global setup - ts-jest配置已移至transform部分

    // 清理模拟
    clearMocks: true,
    restoreMocks: true,

    // 详细输出
    verbose: true,

    // 并行执行
    maxWorkers: 1, // 避免并发问题

    // 模块文件扩展名
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],

    // 转换忽略
    transformIgnorePatterns: ["node_modules/(?!(.*\\.mjs$))", "src/main/wasm/heif-module\\.ts$"],
};
