#!/usr/bin/env node

/**
 * 批量更新文档中的Mermaid图表，添加更大的字体配置
 */

const fs = require("fs");
const glob = require("glob");

// Mermaid字体配置 - 使用更大的字体
const MERMAID_CONFIG = `%%{init: {'theme':'base', 'themeVariables': { 'fontSize': '24px', 'primaryTextColor': '#000', 'primaryColor': '#2563eb', 'lineColor': '#374151', 'actorBkg': '#f3f4f6', 'actorTextColor': '#000', 'actorLineColor': '#000', 'messageTextColor': '#000', 'messageLineColor': '#000', 'labelTextColor': '#000', 'labelBackground': '#f9fafb', 'labelBorder': '#d1d5db', 'sectionBkgColor': '#f8fafc', 'altSectionBkgColor': '#f1f5f9', 'gridColor': '#e5e7eb', 'secondaryColor': '#f59e0b', 'tertiaryColor': '#10b981'}}}%%`;

// 查找所有包含Mermaid图表的Markdown文件
const files = glob.sync("docs/**/*.md");

console.log(`Found ${files.length} markdown files to process...`);

let totalUpdated = 0;

files.forEach((filePath) => {
    try {
        const content = fs.readFileSync(filePath, "utf8");

        // 检查是否包含Mermaid图表
        const mermaidRegex = /```mermaid\n/g;
        const matches = content.match(mermaidRegex);

        if (!matches) {
            return; // 没有Mermaid图表，跳过
        }

        console.log(`Processing: ${filePath} (${matches.length} Mermaid diagrams)`);

        // 替换所有Mermaid代码块，添加字体配置
        const updatedContent = content.replace(
            /```mermaid\n/g,
            `\`\`\`mermaid\n${MERMAID_CONFIG}\n`,
        );

        // 检查是否有更新
        if (updatedContent !== content) {
            fs.writeFileSync(filePath, updatedContent, "utf8");
            totalUpdated += matches.length;
            console.log(`✅ Updated ${matches.length} Mermaid diagrams in ${filePath}`);
        }
    } catch (error) {
        console.error(`❌ Error processing ${filePath}:`, error.message);
    }
});

console.log(
    `\n🎉 Complete! Updated ${totalUpdated} Mermaid diagrams across ${files.length} files.`,
);
console.log("\nFont configuration applied:");
console.log("- Font Size: 24px (much larger!)");
console.log("- Primary Text Color: #000 (black for better contrast)");
console.log("- Primary Color: #2563eb (blue)");
console.log("- Line Color: #374151 (dark gray)");
console.log("- Enhanced contrast and readability");
