#!/usr/bin/env node

/**
 * 📜 测试脚本
 *
 * 🌌 运行 Jest 测试
 */

const { execSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

console.log('🌌 启动表达式解析器测试...');

try {
    execSync('npx jest', {
        cwd: projectRoot,
        stdio: 'inherit',
    });

    console.log('🌌 测试完成！');
} catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
}
