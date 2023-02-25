module.exports = {
    preset: "ts-jest/presets/js-with-ts-esm",
    roots: ["<rootDir>/src"],
    transformIgnorePatterns: [
        "node_modules/(?!(read-chunk|image-type|file-type|strtok3|peek-readable|token-types))",
    ],
    testEnvironment: "node",
};
