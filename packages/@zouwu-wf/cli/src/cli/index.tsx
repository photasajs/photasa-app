/**
 * 🌌 驺吾工作流Schema CLI工具
 *
 * 📜 仙术功能：命令行界面，提供Schema验证、类型生成、验证器生成等功能
 * 🔧 工作流操作：统一的CLI入口，支持多种操作模式
 */

import React from "react";
import { render } from "ink";
import { program } from "commander";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { generateTypesFromSchema, generateTypesFromSchemas } from "../generators/schema-to-types";
import {
    generateValidatorsFromSchema,
    generateValidatorsFromSchemas,
} from "../generators/schema-to-validators";
import { validateWorkflow } from "@zouwu-wf/workflow";
import { load } from "js-yaml";
import { App } from "./ui/App";
import { glob } from "glob";
import { generateWorkflowMermaidMarkdown } from "../generators/workflow-to-mermaid";
import { WorkflowToDoc } from "../generators/workflow-to-doc";
import { generateWorkflowSequenceMarkdown } from "../generators/workflow-to-sequence";

/**
 * 🌌 CLI版本信息
 */
const packageJsonPath = path.join(__dirname, "../package.json");
const packageJsonPathDev = path.join(__dirname, "../../package.json");
const packageJson = JSON.parse(
    fs.existsSync(packageJsonPath)
        ? fs.readFileSync(packageJsonPath, "utf-8")
        : fs.readFileSync(packageJsonPathDev, "utf-8"),
);

program.name("zouwu").description("🌌 驺吾工作流CLI工具集").version(packageJson.version);

// ... (keep generate-types, generate-validators, generate-all, init commands as is or similar, focusing on validate for now)
// For brevity in this refactor, I will keep other commands mostly as is but ensure imports are correct.
// Actually, to avoid losing functionality, I should copy them back.

/**
 * 📜 生成TypeScript类型定义命令
 */
program
    .command("generate-types")
    .description("🔧 从Schema生成TypeScript类型定义")
    .requiredOption("-s, --schema <path>", "输入Schema文件路径")
    .requiredOption("-o, --output <path>", "输出TypeScript文件路径")
    .option("-p, --prefix <name>", "类型名称前缀")
    .option("--no-docs", "不生成文档注释")
    .option("--no-validators", "不生成验证器类型")
    .action(async (options) => {
        try {
            console.log("🌌 启动TypeScript类型生成仙术...");

            await generateTypesFromSchema({
                schemaPath: options.schema,
                outputPath: options.output,
                namePrefix: options.prefix,
                generateDocs: options.docs,
                generateValidators: options.validators,
            });

            console.log("🌌 类型生成仙术完成！");
        } catch (error) {
            console.error("❌ 天劫降临，类型生成失败:", error);
            process.exit(1);
        }
    });

/**
 * 📜 生成验证器命令
 */
program
    .command("generate-validators")
    .description("🔧 从Schema生成运行时验证器")
    .requiredOption("-s, --schema <path>", "输入Schema文件路径")
    .requiredOption("-o, --output <path>", "输出验证器文件路径")
    .option("-p, --prefix <name>", "验证器名称前缀")
    .option("--no-strict", "非严格模式验证")
    .option("--no-chinese", "不使用中文错误信息")
    .action(async (options) => {
        try {
            console.log("🌌 启动验证器生成仙术...");

            await generateValidatorsFromSchema({
                schemaPath: options.schema,
                outputPath: options.output,
                namePrefix: options.prefix,
                strict: options.strict,
                chineseErrors: options.chinese,
            });

            console.log("🌌 验证器生成仙术完成！");
        } catch (error) {
            console.error("❌ 天劫降临，验证器生成失败:", error);
            process.exit(1);
        }
    });

/**
 * 📜 批量生成命令
 */
program
    .command("generate-all")
    .description("🌌 从Schema目录批量生成所有代码")
    .requiredOption("-s, --schema-dir <path>", "输入Schema目录路径")
    .requiredOption("-o, --output-dir <path>", "输出目录路径")
    .option("-p, --prefix <name>", "名称前缀")
    .option("--no-types", "不生成类型定义")
    .option("--no-validators", "不生成验证器")
    .option("--no-docs", "不生成文档注释")
    .option("--no-chinese", "不使用中文错误信息")
    .action(async (options) => {
        try {
            console.log("🌌 启动批量生成仙术...");

            // 确保输出目录存在
            await fs.promises.mkdir(options.outputDir, { recursive: true });

            if (options.types) {
                console.log("📜 正在生成类型定义...");
                const typesDir = path.join(options.outputDir, "types");
                await fs.promises.mkdir(typesDir, { recursive: true });

                await generateTypesFromSchemas(options.schemaDir, typesDir, {
                    namePrefix: options.prefix,
                    generateDocs: options.docs,
                    generateValidators: options.validators,
                });
            }

            if (options.validators) {
                console.log("🔧 正在生成验证器...");
                const validatorsDir = path.join(options.outputDir, "validators");
                await fs.promises.mkdir(validatorsDir, { recursive: true });

                await generateValidatorsFromSchemas(options.schemaDir, validatorsDir, {
                    namePrefix: options.prefix,
                    strict: true,
                    chineseErrors: options.chinese,
                });
            }

            console.log("🌌 批量生成仙术完成！");
        } catch (error) {
            console.error("❌ 天劫降临，批量生成失败:", error);
            process.exit(1);
        }
    });

/**
 * 📜 验证工作流文件命令 (已重构为 Ink UI)
 */
program
    .command("validate")
    .description("🔧 验证工作流YAML文件")
    .option("-f, --file <path>", "工作流YAML文件路径")
    .option("-d, --dir <path>", "工作流目录路径")
    .option("-s, --schema <path>", "Schema文件路径 (默认使用内置schema)")
    .option("-c, --context <path>", "验证上下文JSON文件路径 (包含supportedServices等)")
    .option("-e, --extension-schema <path>", "扩展Schema文件路径")
    .option("--strict", "严格模式验证")
    .option("--verbose", "详细输出模式")
    .option("--ignore-service-errors", "忽略服务名称验证错误 (已废弃，建议使用--context)")
    .action(async (options) => {
        try {
            let files: string[] = [];

            if (options.file) {
                files.push(options.file);
            } else if (options.dir) {
                const pattern = path.join(options.dir, "**/*.{yml,yaml}").replace(/\\/g, "/");
                files = await glob(pattern);
            } else {
                console.error("❌ 请提供 -f <文件> 或 -d <目录>");
                process.exit(1);
            }

            // 加载验证上下文
            let validationOptions: any = {
                strict: options.strict,
            };

            if (options.context) {
                const contextPath = path.resolve(options.context);
                const contextContent = await fs.promises.readFile(contextPath, "utf-8");
                const context = JSON.parse(contextContent);
                validationOptions = { ...validationOptions, ...context };
            }

            if (options.extensionSchema) {
                const extPath = path.resolve(options.extensionSchema);
                const extContent = await fs.promises.readFile(extPath, "utf-8");
                validationOptions.extensionSchema = JSON.parse(extContent);
            }

            const results = await Promise.all(
                files.map(async (file) => {
                    try {
                        const workflowContent = await fs.promises.readFile(file, "utf-8");
                        let workflowData: any;

                        if (file.endsWith(".yaml") || file.endsWith(".yml")) {
                            workflowData = load(workflowContent);
                        } else {
                            workflowData = JSON.parse(workflowContent);
                        }

                        let validationResult = validateWorkflow(workflowData, validationOptions);

                        // If user requested to ignore service name errors, filter them out (Legacy Support)
                        if (options.ignoreServiceErrors && !validationOptions.supportedServices) {
                            const filtered = validationResult.errors.filter(
                                (err) =>
                                    !(
                                        err.path &&
                                        (err.path.includes("service") ||
                                            err.path.includes("action"))
                                    ),
                            );
                            validationResult = { valid: filtered.length === 0, errors: filtered };
                        }
                        return {
                            file: path.relative(process.cwd(), file),
                            valid: validationResult.valid,
                            errors: validationResult.errors,
                        };
                    } catch (err) {
                        return {
                            file: path.relative(process.cwd(), file),
                            valid: false,
                            errors: [
                                {
                                    path: "root",
                                    message: `解析失败: ${(err as Error).message}`,
                                    value: null,
                                },
                            ],
                        };
                    }
                }),
            );

            // 渲染 Ink UI
            const { waitUntilExit } = render(<App results={results} />);
            await waitUntilExit();

            // 退出码 logic
            const hasErrors = results.some((r) => !r.valid);
            if (hasErrors) {
                process.exit(1);
            }
        } catch (error) {
            console.error("❌ 天劫降临，工作流验证失败:", error);
            process.exit(1);
        }
    });

/**
 * 📜 生成工作流图形化 Mermaid 命令
 */
program
    .command("graph")
    .description("🔧 生成工作流 Mermaid 流程图")
    .option("-i, --input <path>", "工作流 YAML 文件路径")
    .option("-d, --dir <path>", "工作流目录路径 (批量生成)")
    .option("-o, --output <path>", "输出文件或目录路径 (可选)")
    .option("--no-markdown", "不使用 Markdown 代码块包装")
    .option("-direction, --direction <dir>", "图表方向 (TD, LR, BT, RL)", "TD")
    .action(async (options) => {
        try {
            let files: string[] = [];

            if (options.input) {
                files.push(path.resolve(options.input));
            } else if (options.dir) {
                const pattern = path.join(options.dir, "**/*.{yml,yaml}").replace(/\\/g, "/");
                files = await glob(pattern);
            } else {
                console.error("❌ 请提供 -i <文件> 或 -d <目录>");
                process.exit(1);
            }

            const isBatch = files.length > 1 || options.dir;

            // 如果是批量模式且指定了输出，确保输出目录存在
            if (isBatch && options.output) {
                await fs.promises.mkdir(path.resolve(options.output), { recursive: true });
            }

            for (const file of files) {
                const workflowContent = await fs.promises.readFile(file, "utf-8");
                let workflowData: any;

                if (file.endsWith(".yaml") || file.endsWith(".yml")) {
                    workflowData = load(workflowContent);
                } else {
                    workflowData = JSON.parse(workflowContent);
                }

                const docGenerator = new WorkflowToDoc(workflowData);
                const apiDoc = docGenerator.generate();

                const flowchart = options.markdown
                    ? generateWorkflowMermaidMarkdown(workflowData, {
                          direction: options.direction as any,
                      })
                    : "";

                const sequence = options.markdown
                    ? generateWorkflowSequenceMarkdown(workflowData)
                    : "";

                const finalOutput = options.markdown
                    ? `${apiDoc}\n## 📊 流程执行图 (Flowchart)\n\n${flowchart}\n\n## 🔄 服务交互时序 (Sequence Diagram)\n\n${sequence}`
                    : flowchart;

                if (options.output) {
                    let outputPath: string;
                    if (isBatch) {
                        const baseName = path.basename(file, path.extname(file));
                        outputPath = path.join(path.resolve(options.output), `${baseName}.md`);
                    } else {
                        outputPath = path.resolve(options.output);
                    }
                    await fs.promises.writeFile(outputPath, finalOutput);
                    console.log(`🌌 秘籍全景图已刻印至: ${outputPath}`);
                } else {
                    if (isBatch) console.log(`--- 📜 ${path.basename(file)} ---`);
                    console.log(finalOutput);
                }
            }
        } catch (error) {
            console.error("❌ 天劫降临，图形生成失败:", error);
            process.exit(1);
        }
    });

/**
 * 📜 初始化项目命令
 */
program
    .command("init")
    .description("🌌 初始化工作流Schema项目")
    .argument("[dir]", "项目目录 (默认为当前目录)", ".")
    .option("--name <name>", "项目名称")
    .option("--description <desc>", "项目描述")
    .action(async (dir: string, options) => {
        try {
            console.log("🌌 启动项目初始化仙术...");

            const projectDir = path.resolve(dir);
            await fs.promises.mkdir(projectDir, { recursive: true });

            // 创建目录结构
            const dirs = ["schemas", "workflows", "generated/types", "generated/validators"];
            for (const subDir of dirs) {
                await fs.promises.mkdir(path.join(projectDir, subDir), { recursive: true });
            }

            // 创建配置文件
            const config = {
                name: options.name || path.basename(projectDir),
                description: options.description || "驺吾工作流Schema项目",
                version: "1.0.0",
                schemaVersion: "1.0.0",
                schemas: {
                    workflow: "./schemas/workflow.schema.json",
                    stepTypes: "./schemas/step-types.schema.json",
                },
                output: {
                    types: "./generated/types",
                    validators: "./generated/validators",
                },
            };

            await fs.promises.writeFile(
                path.join(projectDir, "workflow-schema.config.json"),
                JSON.stringify(config, null, 2),
            );

            // 复制基础Schema文件
            const schemaFiles = [
                "workflow.schema.json",
                "step-types.schema.json",
                "template-syntax.schema.json",
            ];
            for (const schemaFile of schemaFiles) {
                try {
                    const sourcePath = path.resolve(__dirname, `../schemas/${schemaFile}`);
                    const targetPath = path.join(projectDir, "schemas", schemaFile);
                    await fs.promises.copyFile(sourcePath, targetPath);
                } catch (error) {
                    console.warn(`⚠️ 无法找到Schema文件: ${schemaFile}`);
                }
            }

            // 创建示例工作流
            const exampleWorkflow = {
                id: "example_workflow",
                name: "示例工作流",
                description: "这是一个示例工作流，展示基本语法",
                version: "1.0.0",
                author: "驺吾引擎",
                inputs: [
                    {
                        name: "message",
                        type: "string",
                        required: true,
                        description: "要处理的消息",
                    },
                ],
                steps: [
                    {
                        id: "log_message",
                        type: "builtin",
                        action: "log",
                        input: {
                            level: "info",
                            message: "收到消息: {{inputs.message}}",
                        },
                    },
                    {
                        id: "return_result",
                        type: "builtin",
                        action: "return",
                        input: {
                            success: true,
                            data: {
                                processed: true,
                                message: "{{inputs.message}}",
                            },
                        },
                        dependsOn: ["log_message"],
                    },
                ],
            };

            await fs.promises.writeFile(
                path.join(projectDir, "workflows/example.yml"),
                `# 示例工作流
${JSON.stringify(exampleWorkflow, null, 2)}`,
            );

            console.log(`🌌 项目初始化仙术完成！
📁 项目目录: ${projectDir}
📜 配置文件: workflow-schema.config.json
🔧 示例工作流: workflows/example.yml

使用以下命令开始开发：
  cd ${path.relative(process.cwd(), projectDir)}
  workflow-schema generate-all -s schemas -o generated`);
        } catch (error) {
            console.error("❌ 天劫降临，项目初始化失败:", error);
            process.exit(1);
        }
    });

/**
 * 📜 显示版本信息
 */
program
    .command("version")
    .description("🌌 显示版本信息")
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
