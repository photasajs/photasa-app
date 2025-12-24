#!/usr/bin/env node

/**
 * 🌌 驺吾工作流Schema包构建脚本
 *
 * 📜 仙术功能：编译TypeScript代码，生成示例类型和验证器
 * 🔧 工作流操作：自动化构建流程
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🌌 启动驺吾Schema包构建仙术...');

const rootDir = path.join(__dirname, '..');
const buildDir = path.join(rootDir, 'dist');
const _srcDir = path.join(rootDir, 'src');

// 🔧 清理构建目录
function cleanBuildDir() {
    console.log('📜 清理构建目录...');
    try {
        if (fs.existsSync(buildDir)) {
            fs.rmSync(buildDir, { recursive: true, force: true });
        }
        fs.mkdirSync(buildDir, { recursive: true });
    } catch (error) {
        console.error('❌ 清理构建目录失败:', error);
        process.exit(1);
    }
}

// 🌌 编译TypeScript
function compileTypeScript() {
    console.log('📜 编译TypeScript代码...');
    try {
        execSync('npx tsc --build', {
            cwd: rootDir,
            stdio: 'inherit',
        });
        console.log('✅ TypeScript编译完成');
    } catch (error) {
        console.error('❌ TypeScript编译失败:', error);
        process.exit(1);
    }
}

// 🔧 复制Schema文件
function copySchemas() {
    console.log('📜 复制Schema文件...');
    try {
        const schemasSrc = path.join(rootDir, 'schemas');
        const schemasDest = path.join(buildDir, 'schemas');

        if (fs.existsSync(schemasSrc)) {
            fs.mkdirSync(schemasDest, { recursive: true });

            const schemaFiles = fs.readdirSync(schemasSrc);
            for (const file of schemaFiles) {
                if (file.endsWith('.json')) {
                    fs.copyFileSync(path.join(schemasSrc, file), path.join(schemasDest, file));
                }
            }
        }
        console.log('✅ Schema文件复制完成');
    } catch (error) {
        console.error('❌ Schema文件复制失败:', error);
        process.exit(1);
    }
}

// 🌌 复制package.json
function copyPackageJson() {
    console.log('📜 复制package.json...');
    try {
        const packageJsonSrc = path.join(rootDir, 'package.json');
        const packageJsonDest = path.join(buildDir, 'package.json');

        if (fs.existsSync(packageJsonSrc)) {
            const packageData = JSON.parse(fs.readFileSync(packageJsonSrc, 'utf-8'));

            // 调整路径和移除开发依赖
            delete packageData.devDependencies;
            delete packageData.scripts.build;
            delete packageData.scripts.dev;

            fs.writeFileSync(packageJsonDest, JSON.stringify(packageData, null, 2));
        }
        console.log('✅ package.json复制完成');
    } catch (error) {
        console.error('❌ package.json复制失败:', error);
        process.exit(1);
    }
}

// 🔧 生成示例类型和验证器
function generateExamples() {
    console.log('📜 生成示例类型和验证器...');
    try {
        const examplesDir = path.join(buildDir, 'examples');
        fs.mkdirSync(examplesDir, { recursive: true });

        // 生成类型定义示例
        const typesDir = path.join(examplesDir, 'types');
        fs.mkdirSync(typesDir, { recursive: true });

        // 生成验证器示例
        const validatorsDir = path.join(examplesDir, 'validators');
        fs.mkdirSync(validatorsDir, { recursive: true });

        // 使用构建好的生成器
        const { generateTypesFromSchemas } = require(
            path.join(buildDir, 'generators/schema-to-types')
        );
        const { generateValidatorsFromSchemas } = require(
            path.join(buildDir, 'generators/schema-to-validators')
        );

        const schemasDir = path.join(buildDir, 'schemas');

        if (fs.existsSync(schemasDir)) {
            // 生成类型定义
            generateTypesFromSchemas(schemasDir, typesDir, {
                generateDocs: true,
                generateValidators: true,
            })
                .then(() => {
                    console.log('✅ 示例类型定义生成完成');
                })
                .catch((error) => {
                    console.warn('⚠️ 示例类型定义生成失败:', error);
                });

            // 生成验证器
            generateValidatorsFromSchemas(schemasDir, validatorsDir, {
                strict: true,
                chineseErrors: true,
            })
                .then(() => {
                    console.log('✅ 示例验证器生成完成');
                })
                .catch((error) => {
                    console.warn('⚠️ 示例验证器生成失败:', error);
                });
        }
    } catch (error) {
        console.warn('⚠️ 示例生成失败:', error);
        // 不退出进程，因为这不是关键步骤
    }
}

// 🌌 创建CLI可执行文件
function createCliExecutable() {
    console.log('📜 创建CLI可执行文件...');
    try {
        const cliSrc = path.join(buildDir, 'cli/index.js');
        const cliBin = path.join(buildDir, 'bin/workflow-schema');

        if (fs.existsSync(cliSrc)) {
            // 创建bin目录
            fs.mkdirSync(path.join(buildDir, 'bin'), { recursive: true });

            // 创建可执行文件
            const cliContent = `#!/usr/bin/env node
require('../cli/index.js');
`;
            fs.writeFileSync(cliBin, cliContent);

            // 设置可执行权限
            if (process.platform !== 'win32') {
                fs.chmodSync(cliBin, '755');
            }
        }
        console.log('✅ CLI可执行文件创建完成');
    } catch (error) {
        console.error('❌ CLI可执行文件创建失败:', error);
        process.exit(1);
    }
}

// 🔧 生成README
function generateReadme() {
    console.log('📜 生成README文件...');
    try {
        const readmeContent = `# @systembug/workflow-schema

🌌 驺吾工作流Schema包 - 提供完整的工作流开发工具链

## 📜 功能特性

- ✅ JSON Schema定义工作流语法
- ✅ TypeScript类型生成
- ✅ 运行时验证器生成
- ✅ 模板语法验证
- ✅ 中文错误信息
- ✅ CLI工具集
- ✅ 批量处理

## 🔧 安装

\`\`\`bash
npm install @systembug/workflow-schema
\`\`\`

## 🌌 使用方法

### 编程接口

\`\`\`typescript
import { validateWorkflow, generateTypesFromSchema } from '@systembug/workflow-schema';

// 验证工作流
const result = validateWorkflow(workflowData);
if (result.valid) {
  console.log('工作流验证通过');
} else {
  console.error('验证失败:', result.errors);
}

// 生成类型定义
await generateTypesFromSchema({
  schemaPath: './schemas/workflow.schema.json',
  outputPath: './types/workflow.types.ts'
});
\`\`\`

### CLI工具

\`\`\`bash
# 初始化项目
workflow-schema init my-project

# 生成类型定义
workflow-schema generate-types -s schema.json -o types.ts

# 生成验证器
workflow-schema generate-validators -s schema.json -o validators.ts

# 批量生成
workflow-schema generate-all -s schemas/ -o generated/

# 验证工作流
workflow-schema validate -f workflow.yml
\`\`\`

## 📜 文档

详细文档请参考项目README.md文件。

## 🌟 许可证

MIT License
`;

        fs.writeFileSync(path.join(buildDir, 'README.md'), readmeContent);
        console.log('✅ README文件生成完成');
    } catch (error) {
        console.error('❌ README文件生成失败:', error);
        process.exit(1);
    }
}

// 🌌 主构建流程
async function main() {
    try {
        cleanBuildDir();
        compileTypeScript();
        copySchemas();
        copyPackageJson();
        createCliExecutable();
        generateReadme();

        // 异步生成示例（不阻塞主流程）
        setTimeout(generateExamples, 1000);

        console.log('🌌 驺吾Schema包构建仙术完成！');
        console.log(`📁 构建目录: ${buildDir}`);
        console.log('🔧 可以通过以下命令发布:');
        console.log('  cd dist && npm publish');
    } catch (error) {
        console.error('❌ 天劫降临，构建失败:', error);
        process.exit(1);
    }
}

// 执行构建
main();
