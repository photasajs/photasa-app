/**
 * Jest configuration for main process tests
 * 只用于main进程测试，不涉及renderer测试
 */

module.exports = {
    // 测试环境
    testEnvironment: "node",

    // 测试文件匹配模式 - 匹配main和engines目录下的测试
    testMatch: [
        "<rootDir>/src/main/scan/worker/__tests__/**/*.spec.ts",
        "<rootDir>/src/main/workers/__tests__/**/*.spec.ts",
        "<rootDir>/src/main/thumbnail/__tests__/**/*.spec.ts",
        "<rootDir>/src/engines/**/__tests__/**/*.spec.ts",
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
                    lib: ["es2020"],
                    allowSyntheticDefaultImports: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                    strict: false,
                    noImplicitAny: false,
                    noImplicitReturns: false,
                    noImplicitThis: false,
                    noUnusedLocals: false,
                    noUnusedParameters: false,
                    types: ["node", "jest"],
                    typeRoots: ["node_modules/@types"],
                },
            },
        ],
    },

    // 模块解析 - 使用正确的Jest属性名
    moduleNameMapper: {
        "^@common/(.*)$": "<rootDir>/src/common/$1",
        "^@main/(.*)$": "<rootDir>/src/main/$1",
        "^@renderer/(.*)$": "<rootDir>/src/renderer/$1",
        "^@shared/(.*)$": "<rootDir>/src/shared/$1",
        "^@maliang/(.*)$": "<rootDir>/src/engines/maliang/$1",
        "^@shunfenger/(.*)$": "<rootDir>/src/engines/shunfenger/$1",
    },

    // 测试超时设置
    testTimeout: 15000,

    // 覆盖率设置
    collectCoverageFrom: [
        "src/main/**/*.ts",
        "src/engines/**/*.ts",
        "!src/main/**/*.d.ts",
        "!src/engines/**/*.d.ts",
        "!src/main/**/__tests__/**",
        "!src/engines/**/__tests__/**",
        "!src/main/**/node_modules/**",
        "!src/engines/**/node_modules/**",
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
