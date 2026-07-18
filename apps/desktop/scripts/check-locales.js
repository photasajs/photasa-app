#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const glob = require("glob");

// Colors for console output
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
};

// Helper function to get all paths in an object
function getAllPaths(obj, prefix = "") {
    const paths = new Set();

    for (const key in obj) {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        paths.add(fullPath);

        if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
            const subPaths = getAllPaths(obj[key], fullPath);
            subPaths.forEach((path) => paths.add(path));
        }
    }

    return paths;
}

// Function to find duplicate keys within same level
function findDuplicateKeys(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const duplicates = [];
    let currentPath = [];
    const seenKeys = new Map();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^(\s*)"([^"]+)"\s*:/);

        if (match) {
            const indent = match[1].length;
            const key = match[2];

            // Update current path based on indentation
            currentPath = currentPath.filter((p) => p.indent < indent);

            const parentPath = currentPath.map((p) => p.key).join(".");
            const keyAtLevel = parentPath + "." + key;

            if (seenKeys.has(keyAtLevel)) {
                duplicates.push({
                    key,
                    line: i + 1,
                    firstLine: seenKeys.get(keyAtLevel),
                    path: parentPath,
                });
            } else {
                seenKeys.set(keyAtLevel, i + 1);
            }

            // If this line ends with { or [, it's starting a new object/array
            if (line.match(/[{\[]s*$/)) {
                currentPath.push({ key, indent });
            }
        }

        // Handle closing braces/brackets
        if (line.match(/^\s*[}\]]/)) {
            const indent = line.match(/^(\s*)/)[1].length;
            currentPath = currentPath.filter((p) => p.indent < indent);
        }
    }

    return duplicates;
}

// Main function to check locale consistency
async function checkLocales() {
    const localesDir = path.join(process.cwd(), "src/renderer/src/locales");
    const localeFiles = glob.sync(path.join(localesDir, "*.json"));

    if (localeFiles.length === 0) {
        console.error(`${colors.red}No locale files found in ${localesDir}${colors.reset}`);
        process.exit(1);
    }

    console.log(`${colors.cyan}Checking ${localeFiles.length} locale files...${colors.reset}\n`);

    const locales = {};
    const errors = [];

    // Load all locale files
    for (const file of localeFiles) {
        const basename = path.basename(file);
        try {
            const content = JSON.parse(fs.readFileSync(file, "utf-8"));
            locales[basename] = {
                content,
                paths: getAllPaths(content),
                file,
            };
        } catch (error) {
            errors.push(`${colors.red}Error parsing ${basename}: ${error.message}${colors.reset}`);
        }
    }

    // Use en-US.json as the reference
    const referenceFile = "en-US.json";
    if (!locales[referenceFile]) {
        console.error(`${colors.red}Reference file ${referenceFile} not found${colors.reset}`);
        process.exit(1);
    }

    const referencePaths = locales[referenceFile].paths;

    // Check for duplicate keys within each file
    console.log(`${colors.blue}Checking for duplicate keys...${colors.reset}`);
    let hasDuplicates = false;

    for (const [filename, locale] of Object.entries(locales)) {
        const duplicates = findDuplicateKeys(locale.file);
        if (duplicates.length > 0) {
            hasDuplicates = true;
            console.log(`\n${colors.yellow}Duplicate keys in ${filename}:${colors.reset}`);
            duplicates.forEach((dup) => {
                console.log(
                    `  - Key "${dup.key}" at line ${dup.line} (first occurrence at line ${dup.firstLine})`,
                );
                if (dup.path) {
                    console.log(`    Path: ${dup.path}`);
                }
            });
        }
    }

    if (!hasDuplicates) {
        console.log(`${colors.green}✓ No duplicate keys found${colors.reset}`);
    }

    // Check for missing keys
    console.log(
        `\n${colors.blue}Checking for missing keys (using ${referenceFile} as reference)...${colors.reset}`,
    );
    let hasMissingKeys = false;

    for (const [filename, locale] of Object.entries(locales)) {
        if (filename === referenceFile) continue;

        const missingKeys = [...referencePaths].filter((path) => !locale.paths.has(path));
        if (missingKeys.length > 0) {
            hasMissingKeys = true;
            console.log(`\n${colors.yellow}Missing keys in ${filename}:${colors.reset}`);
            missingKeys.forEach((key) => console.log(`  - ${key}`));
        }
    }

    if (!hasMissingKeys) {
        console.log(`${colors.green}✓ All required keys present${colors.reset}`);
    }

    // Check for extra keys
    console.log(`\n${colors.blue}Checking for extra keys...${colors.reset}`);
    let hasExtraKeys = false;

    for (const [filename, locale] of Object.entries(locales)) {
        if (filename === referenceFile) continue;

        const extraKeys = [...locale.paths].filter((path) => !referencePaths.has(path));
        if (extraKeys.length > 0) {
            hasExtraKeys = true;
            console.log(`\n${colors.yellow}Extra keys in ${filename}:${colors.reset}`);
            extraKeys.forEach((key) => console.log(`  - ${key}`));
        }
    }

    if (!hasExtraKeys) {
        console.log(`${colors.green}✓ No extra keys found${colors.reset}`);
    }

    // Check value types consistency
    console.log(`\n${colors.blue}Checking value type consistency...${colors.reset}`);
    let hasTypeInconsistency = false;

    for (const refPath of referencePaths) {
        const refValue = getValueByPath(locales[referenceFile].content, refPath);
        const refType = typeof refValue;

        for (const [filename, locale] of Object.entries(locales)) {
            if (filename === referenceFile) continue;

            if (locale.paths.has(refPath)) {
                const value = getValueByPath(locale.content, refPath);
                const valueType = typeof value;

                if (refType !== valueType) {
                    hasTypeInconsistency = true;
                    console.log(`\n${colors.yellow}Type mismatch for "${refPath}":${colors.reset}`);
                    console.log(`  - ${referenceFile}: ${refType}`);
                    console.log(`  - ${filename}: ${valueType}`);
                }
            }
        }
    }

    if (!hasTypeInconsistency) {
        console.log(`${colors.green}✓ All value types consistent${colors.reset}`);
    }

    // Print summary
    console.log(`\n${colors.cyan}=== Summary ===${colors.reset}`);

    if (errors.length > 0) {
        console.log(`${colors.red}Parsing errors:${colors.reset}`);
        errors.forEach((error) => console.log(`  ${error}`));
    }

    const hasIssues =
        hasDuplicates ||
        hasMissingKeys ||
        hasExtraKeys ||
        hasTypeInconsistency ||
        errors.length > 0;

    if (hasIssues) {
        console.log(`\n${colors.red}❌ Locale consistency check failed${colors.reset}`);
        process.exit(1);
    } else {
        console.log(`\n${colors.green}✅ All locale files are consistent!${colors.reset}`);
        process.exit(0);
    }
}

// Helper function to get value by path
function getValueByPath(obj, path) {
    const parts = path.split(".");
    let current = obj;

    for (const part of parts) {
        if (current && typeof current === "object" && part in current) {
            current = current[part];
        } else {
            return undefined;
        }
    }

    return current;
}

// Run the checker
checkLocales().catch((error) => {
    console.error(`${colors.red}Unexpected error: ${error.message}${colors.reset}`);
    process.exit(1);
});
