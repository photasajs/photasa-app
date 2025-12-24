#!/usr/bin/env node

/**
 * 📜 构建脚本
 *
 * 🌌 编译 TypeScript 代码
 */

const { execSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

console.log('🌌 开始构建表达式解析器...');

try {
    // 编译 TypeScript
    console.log('📜 编译 TypeScript...');
    execSync('npm run compile', {
        cwd: projectRoot,
        stdio: 'inherit',
    });

    console.log('🌌 构建完成！');
} catch (error) {
    console.error('❌ 构建失败:', error.message);
    process.exit(1);
}
