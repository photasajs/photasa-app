const fs = require("fs");
const path = require("path");

// Load the baseline file (zh-CN.json)
const baselinePath = path.join(__dirname, "src/renderer/src/locales/zh-CN.json");
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

// Extract all keys from an object recursively
function extractKeys(obj, prefix = "") {
    let keys = [];

    for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
            keys = keys.concat(extractKeys(obj[key], fullKey));
        } else {
            keys.push(fullKey);
        }
    }

    return keys;
}

// Get all locale files
const localesDir = path.join(__dirname, "src/renderer/src/locales");
const localeFiles = fs.readdirSync(localesDir).filter((file) => file.endsWith(".json"));

// Extract baseline keys
const baselineKeys = new Set(extractKeys(baseline));
console.log(`\n=== Locale Analysis Report ===`);
console.log(`Baseline: zh-CN.json`);
console.log(`Total keys in baseline: ${baselineKeys.size}\n`);

// Analyze each locale file
const results = {};

localeFiles.forEach((file) => {
    if (file === "zh-CN.json") return; // Skip baseline

    const localePath = path.join(localesDir, file);
    const localeData = JSON.parse(fs.readFileSync(localePath, "utf8"));
    const localeKeys = new Set(extractKeys(localeData));

    // Find missing keys (in baseline but not in locale)
    const missingKeys = [...baselineKeys].filter((key) => !localeKeys.has(key));

    // Find extra keys (in locale but not in baseline)
    const extraKeys = [...localeKeys].filter((key) => !baselineKeys.has(key));

    results[file] = {
        totalKeys: localeKeys.size,
        missingKeys: missingKeys,
        missingCount: missingKeys.length,
        extraKeys: extraKeys,
        extraCount: extraKeys.length,
        completeness: (
            ((baselineKeys.size - missingKeys.length) / baselineKeys.size) *
            100
        ).toFixed(1),
    };
});

// Sort by missing count (descending)
const sortedResults = Object.entries(results).sort((a, b) => b[1].missingCount - a[1].missingCount);

// Print summary
console.log(`=== Summary by Language ===\n`);
sortedResults.forEach(([file, data]) => {
    console.log(
        `${file.padEnd(15)} - Missing: ${data.missingCount.toString().padStart(3)} keys (${data.completeness}% complete) | Extra: ${data.extraCount} keys`,
    );
});

// Print detailed missing keys for each language
console.log(`\n=== Detailed Missing Keys by Language ===\n`);
sortedResults.forEach(([file, data]) => {
    if (data.missingCount > 0) {
        console.log(`\n${file} (Missing ${data.missingCount} keys):`);
        console.log("-".repeat(50));
        data.missingKeys.forEach((key) => console.log(`  - ${key}`));
    }
});

// Print extra keys if any
console.log(`\n=== Extra Keys (not in baseline) ===\n`);
sortedResults.forEach(([file, data]) => {
    if (data.extraCount > 0) {
        console.log(`\n${file} (${data.extraCount} extra keys):`);
        console.log("-".repeat(50));
        data.extraKeys.forEach((key) => console.log(`  + ${key}`));
    }
});

// Create a CSV report
const csvPath = path.join(__dirname, "locale_analysis_report.csv");
const csvContent = [
    "Language,Total Keys,Missing Keys,Missing %,Extra Keys,Completeness %",
    ...sortedResults.map(
        ([file, data]) =>
            `${file},${data.totalKeys},${data.missingCount},${((data.missingCount / baselineKeys.size) * 100).toFixed(1)},${data.extraCount},${data.completeness}`,
    ),
].join("\n");

fs.writeFileSync(csvPath, csvContent);
console.log(`\n✅ CSV report saved to: ${csvPath}`);
