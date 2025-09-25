/**
 * Jest configuration for main process tests
 * 只用于main进程测试，不涉及renderer测试
 */

module.exports = {
    // 测试环境
    testEnvironment: "node",

    // 测试文件匹配模式 - 只匹配main目录下的测试
    testMatch: [
        "<rootDir>/src/main/scan/worker/__tests__/**/*.spec.ts",
        "<rootDir>/src/main/workers/__tests__/**/*.spec.ts",
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
    },

    // 测试超时设置
    testTimeout: 15000,

    // 覆盖率设置
    collectCoverageFrom: [
        "src/main/**/*.ts",
        "!src/main/**/*.d.ts",
        "!src/main/**/__tests__/**",
        "!src/main/**/node_modules/**",
    ],

    // 设置文件
    setupFilesAfterEnv: ["<rootDir>/test/setup.main.jest.ts"],

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
    transformIgnorePatterns: ["node_modules/(?!(.*\\.mjs$))"],
};
