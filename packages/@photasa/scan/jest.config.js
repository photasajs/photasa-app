/**
 * Jest configuration for @photasa/scan
 * Runs .spec.ts files (Jest-based tests)
 */

module.exports = {
    testEnvironment: "node",
    testMatch: ["<rootDir>/src/**/__tests__/**/*.spec.ts"],
    preset: "ts-jest",
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
                    types: ["node", "jest", "@jest/globals"],
                    baseUrl: ".",
                    paths: {
                        "@photasa/common": ["../../common/src/index"],
                        "@photasa/config-core": ["../config-core/src/index"],
                    },
                },
            },
        ],
    },
    moduleNameMapper: {
        "^@photasa/common$": "<rootDir>/../../common/src/index",
        "^@photasa/config-core$": "<rootDir>/../config-core/src/index",
    },
    testTimeout: 15000,
    clearMocks: true,
    restoreMocks: true,
    verbose: true,
    maxWorkers: 1,
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
    transformIgnorePatterns: ["node_modules/(?!(.*\\.mjs$))"],
};
