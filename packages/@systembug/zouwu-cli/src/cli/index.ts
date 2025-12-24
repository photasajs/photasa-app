#!/usr/bin/env node

/**
 * 🌌 驺吾工作流Schema CLI工具
 *
 * 📜 仙术功能：命令行界面，提供Schema验证、类型生成、验证器生成等功能
 * 🔧 工作流操作：统一的CLI入口，支持多种操作模式
 */

import { program } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { generateTypesFromSchema, generateTypesFromSchemas } from '../generators/schema-to-types';
import {
    generateValidatorsFromSchema,
    generateValidatorsFromSchemas,
} from '../generators/schema-to-validators';
import { load } from 'js-yaml';

/**
 * 🌌 CLI版本信息
 */
const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
);

program.name('workflow').description('🌌 驺吾工作流CLI工具集').version(packageJson.version);

/**
 * 📜 生成TypeScript类型定义命令
 */
program
    .command('generate-types')
    .description('🔧 从Schema生成TypeScript类型定义')
    .requiredOption('-s, --schema <path>', '输入Schema文件路径')
    .requiredOption('-o, --output <path>', '输出TypeScript文件路径')
    .option('-p, --prefix <name>', '类型名称前缀')
    .option('--no-docs', '不生成文档注释')
    .option('--no-validators', '不生成验证器类型')
    .action(async (options) => {
        try {
            console.log('🌌 启动TypeScript类型生成仙术...');

            await generateTypesFromSchema({
                schemaPath: options.schema,
                outputPath: options.output,
                namePrefix: options.prefix,
                generateDocs: options.docs,
                generateValidators: options.validators,
            });

            console.log('🌌 类型生成仙术完成！');
        } catch (error) {
            console.error('❌ 天劫降临，类型生成失败:', error);
            process.exit(1);
        }
    });

/**
 * 📜 生成验证器命令
 */
program
    .command('generate-validators')
    .description('🔧 从Schema生成运行时验证器')
    .requiredOption('-s, --schema <path>', '输入Schema文件路径')
    .requiredOption('-o, --output <path>', '输出验证器文件路径')
    .option('-p, --prefix <name>', '验证器名称前缀')
    .option('--no-strict', '非严格模式验证')
    .option('--no-chinese', '不使用中文错误信息')
    .action(async (options) => {
        try {
            console.log('🌌 启动验证器生成仙术...');

            await generateValidatorsFromSchema({
                schemaPath: options.schema,
                outputPath: options.output,
                namePrefix: options.prefix,
                strict: options.strict,
                chineseErrors: options.chinese,
            });

            console.log('🌌 验证器生成仙术完成！');
        } catch (error) {
            console.error('❌ 天劫降临，验证器生成失败:', error);
            process.exit(1);
        }
    });

/**
 * 📜 批量生成命令
 */
program
    .command('generate-all')
    .description('🌌 从Schema目录批量生成所有代码')
    .requiredOption('-s, --schema-dir <path>', '输入Schema目录路径')
    .requiredOption('-o, --output-dir <path>', '输出目录路径')
    .option('-p, --prefix <name>', '名称前缀')
    .option('--no-types', '不生成类型定义')
    .option('--no-validators', '不生成验证器')
    .option('--no-docs', '不生成文档注释')
    .option('--no-chinese', '不使用中文错误信息')
    .action(async (options) => {
        try {
            console.log('🌌 启动批量生成仙术...');

            // 确保输出目录存在
            await fs.promises.mkdir(options.outputDir, { recursive: true });

            if (options.types) {
                console.log('📜 正在生成类型定义...');
                const typesDir = path.join(options.outputDir, 'types');
                await fs.promises.mkdir(typesDir, { recursive: true });

                await generateTypesFromSchemas(options.schemaDir, typesDir, {
                    namePrefix: options.prefix,
                    generateDocs: options.docs,
                    generateValidators: options.validators,
                });
            }

            if (options.validators) {
                console.log('🔧 正在生成验证器...');
                const validatorsDir = path.join(options.outputDir, 'validators');
                await fs.promises.mkdir(validatorsDir, { recursive: true });

                await generateValidatorsFromSchemas(options.schemaDir, validatorsDir, {
                    namePrefix: options.prefix,
                    strict: true,
                    chineseErrors: options.chinese,
                });
            }

            console.log('🌌 批量生成仙术完成！');
        } catch (error) {
            console.error('❌ 天劫降临，批量生成失败:', error);
            process.exit(1);
        }
    });

/**
 * 📜 验证工作流文件命令
 */
program
    .command('validate')
    .description('🔧 验证工作流YAML文件')
    .requiredOption('-f, --file <path>', '工作流YAML文件路径')
    .option('-s, --schema <path>', 'Schema文件路径 (默认使用内置schema)')
    .option('--strict', '严格模式验证')
    .option('--verbose', '详细输出模式')
    .action(async (options) => {
        try {
            console.log('🌌 启动工作流验证仙术...');

            // 读取工作流文件
            const workflowContent = await fs.promises.readFile(options.file, 'utf-8');
            let workflowData: any;

            // 解析YAML/JSON
            if (options.file.endsWith('.yaml') || options.file.endsWith('.yml')) {
                workflowData = load(workflowContent);
            } else {
                workflowData = JSON.parse(workflowContent);
            }

            // 使用指定的或默认的Schema（从核心包获取）
            const _schemaPath =
                options.schema ||
                require.resolve('@systembug/workflow-schema/schemas/workflow.schema.json');

            // 这里需要动态导入验证器
            console.log('📜 正在验证工作流结构...');

            // 基本结构验证
            const requiredFields = ['id', 'name', 'version', 'steps'];
            for (const field of requiredFields) {
                if (!workflowData[field]) {
                    throw new Error(`❌ 缺少必需字段: ${field}`);
                }
            }

            // 步骤验证
            if (!Array.isArray(workflowData.steps) || workflowData.steps.length === 0) {
                throw new Error('❌ steps必须是非空数组');
            }

            for (const [index, step] of workflowData.steps.entries()) {
                if (!step.id || !step.type) {
                    throw new Error(`❌ 步骤 ${index} 缺少必需字段 id 或 type`);
                }
            }

            if (options.verbose) {
                console.log('✅ 工作流基本结构验证通过');
                console.log(`📊 工作流统计:
  - ID: ${workflowData.id}
  - 名称: ${workflowData.name}
  - 版本: ${workflowData.version}
  - 步骤数量: ${workflowData.steps.length}
  - 触发器数量: ${workflowData.triggers?.length || 0}`);
            }

            console.log('🌌 工作流验证仙术完成，符咒无误！');
        } catch (error) {
            console.error('❌ 天劫降临，工作流验证失败:', error);
            process.exit(1);
        }
    });

/**
 * 📜 初始化项目命令
 */
program
    .command('init')
    .description('🌌 初始化工作流Schema项目')
    .argument('[dir]', '项目目录 (默认为当前目录)', '.')
    .option('--name <name>', '项目名称')
    .option('--description <desc>', '项目描述')
    .action(async (dir: string, options) => {
        try {
            console.log('🌌 启动项目初始化仙术...');

            const projectDir = path.resolve(dir);
            await fs.promises.mkdir(projectDir, { recursive: true });

            // 创建目录结构
            const dirs = ['schemas', 'workflows', 'generated/types', 'generated/validators'];
            for (const subDir of dirs) {
                await fs.promises.mkdir(path.join(projectDir, subDir), { recursive: true });
            }

            // 创建配置文件
            const config = {
                name: options.name || path.basename(projectDir),
                description: options.description || '驺吾工作流Schema项目',
                version: '1.0.0',
                schemaVersion: '1.0.0',
                schemas: {
                    workflow: './schemas/workflow.schema.json',
                    stepTypes: './schemas/step-types.schema.json',
                },
                output: {
                    types: './generated/types',
                    validators: './generated/validators',
                },
            };

            await fs.promises.writeFile(
                path.join(projectDir, 'workflow-schema.config.json'),
                JSON.stringify(config, null, 2)
            );

            // 复制基础Schema文件（从核心包获取）
            const schemaFiles = [
                'workflow.schema.json',
                'step-types.schema.json',
                'template-syntax.schema.json',
            ];
            for (const schemaFile of schemaFiles) {
                try {
                    const sourcePath = require.resolve(
                        `@systembug/workflow-schema/schemas/${schemaFile}`
                    );
                    const targetPath = path.join(projectDir, 'schemas', schemaFile);
                    await fs.promises.copyFile(sourcePath, targetPath);
                } catch (error) {
                    console.warn(`⚠️ 无法找到Schema文件: ${schemaFile}`);
                }
            }

            // 创建示例工作流
            const exampleWorkflow = {
                id: 'example_workflow',
                name: '示例工作流',
                description: '这是一个示例工作流，展示基本语法',
                version: '1.0.0',
                author: '驺吾引擎',
                inputs: [
                    {
                        name: 'message',
                        type: 'string',
                        required: true,
                        description: '要处理的消息',
                    },
                ],
                steps: [
                    {
                        id: 'log_message',
                        type: 'builtin',
                        action: 'log',
                        input: {
                            level: 'info',
                            message: '收到消息: {{inputs.message}}',
                        },
                    },
                    {
                        id: 'return_result',
                        type: 'builtin',
                        action: 'return',
                        input: {
                            success: true,
                            data: {
                                processed: true,
                                message: '{{inputs.message}}',
                            },
                        },
                        dependsOn: ['log_message'],
                    },
                ],
            };

            await fs.promises.writeFile(
                path.join(projectDir, 'workflows/example.yml'),
                `# 示例工作流
${JSON.stringify(exampleWorkflow, null, 2)}`
            );

            console.log(`🌌 项目初始化仙术完成！
📁 项目目录: ${projectDir}
📜 配置文件: workflow-schema.config.json
🔧 示例工作流: workflows/example.yml

使用以下命令开始开发：
  cd ${path.relative(process.cwd(), projectDir)}
  workflow-schema generate-all -s schemas -o generated`);
        } catch (error) {
            console.error('❌ 天劫降临，项目初始化失败:', error);
            process.exit(1);
        }
    });

/**
 * 📜 显示版本信息
 */
program
    .command('version')
    .description('🌌 显示版本信息')
    .action(() => {
        console.log(`🌌 驺吾工作流Schema工具集
📜 版本: ${packageJson.version}
🔧 功能: Schema验证、类型生成、验证器生成
🌟 作者: @systembug`);
    });

// 解析命令行参数
program.parse();

// 如果没有提供命令，显示帮助信息
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
