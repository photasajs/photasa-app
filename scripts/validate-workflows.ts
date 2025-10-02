#!/usr/bin/env tsx
/**
 * YAML工作流验证工具
 * 专业的CLI工具，用于验证工作流文件的RFC合规性和变量路径语义
 */

import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import * as yaml from "js-yaml";
import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import boxen from "boxen";
import ora from "ora";

interface WorkflowDefinition {
    id: string;
    name: string;
    version: string;
    steps: any[];
    [key: string]: any;
}

/**
 * 验证模板变量格式是否符合RFC 0037规范
 */
function validateTemplateVariables(content: string, _filePath: string): string[] {
    const errors: string[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1;

        // 检查错误的${}格式
        const dollarBracePattern = /\$\{[^}]*\}/g;
        const dollarMatches = line.match(dollarBracePattern);
        if (dollarMatches) {
            errors.push(
                `第${lineNumber}行: 发现不合典制的符咒格式 "${dollarMatches.join(", ")}"，` +
                    `天枢RFC 0037典制要求使用双花括号符咒而非美元符号`,
            );
        }

        // 检查正确的{{}}格式中的语法错误
        const templatePattern = /\{\{([^}]*)\}\}/g;
        let match: RegExpExecArray | null;
        while ((match = templatePattern.exec(line)) !== null) {
            const variableContent = match[1].trim();

            // 检查空变量
            if (!variableContent) {
                errors.push(`第${lineNumber}行: 发现虚无符文 "{{}}"，仙法符文内不可无物`);
                continue;
            }

            // 检查变量路径格式
            if (variableContent.includes("steps.")) {
                // 验证步骤变量路径格式: steps.stepId.output.field 或 steps.stepId.field
                const stepPathPattern =
                    /^steps\.([a-zA-Z_][a-zA-Z0-9_]*)(\.output)?(\.[a-zA-Z_][a-zA-Z0-9_.]*)$/;
                if (!stepPathPattern.test(variableContent)) {
                    errors.push(
                        `第${lineNumber}行: 步骤符路格式有误 "{{${variableContent}}}"，` +
                            `正确符路应为: steps.步骤名.output.字段 或 steps.步骤名.字段`,
                    );
                }

                // 检查是否有双重.output路径（常见错误）
                if (variableContent.includes(".output.output")) {
                    errors.push(
                        `第${lineNumber}行: 发现重复的output符路 "{{${variableContent}}}"，` +
                            `此乃重叠符路之误，请检查符路书写`,
                    );
                }
            } else if (variableContent.includes("input.")) {
                // 验证输入变量路径格式: input.fieldName
                const inputPathPattern = /^input\.[a-zA-Z_][a-zA-Z0-9_.]*$/;
                if (!inputPathPattern.test(variableContent)) {
                    errors.push(
                        `第${lineNumber}行: 输入符路格式有误 "{{${variableContent}}}"，` +
                            `正确符路应为: input.字段名`,
                    );
                }
            }

            // 检查函数调用格式
            if (variableContent.includes("(") && variableContent.includes(")")) {
                const complexFunctionPattern = /^[a-zA-Z_][a-zA-Z0-9_.]*\([^)]*\).*$/;
                if (!complexFunctionPattern.test(variableContent)) {
                    errors.push(
                        `第${lineNumber}行: 仙术调用格式有误 "{{${variableContent}}}"，` +
                            `请检查仙术名称与符咒书写`,
                    );
                }
            }
        }
    }

    return errors;
}

/**
 * 验证工作流必需字段
 */
function validateWorkflowRequired(workflow: WorkflowDefinition, _filePath: string): string[] {
    const errors: string[] = [];

    // 必需字段检查
    const requiredFields = ["id", "name", "version", "steps"];
    for (const field of requiredFields) {
        if (!workflow[field as keyof WorkflowDefinition]) {
            errors.push(`工作流典籍缺少必备字段: "${field}"`);
        }
    }

    // steps必须是数组
    if (workflow.steps && !Array.isArray(workflow.steps)) {
        errors.push(`"steps" 字段必须为步骤序列`);
    }

    return errors;
}

/**
 * 验证步骤间的变量路径语义
 * 检查 steps.xxx.output.yyy 路径是否与 output_schema 匹配
 */
function validateStepOutputReferences(steps: any[], content: string, _filePath: string): string[] {
    const errors: string[] = [];

    // 构建步骤ID到output_schema的映射
    const stepSchemas = new Map<string, any>();
    for (const step of steps) {
        if (step.id && step.output_schema) {
            stepSchemas.set(step.id, step.output_schema);
        }
    }

    // 查找所有 steps.xxx.output.yyy 模式的变量引用
    const stepRefPattern =
        /\{\{steps\.([a-zA-Z_][a-zA-Z0-9_]*)\.output\.([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g;
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1;
        let match: RegExpExecArray | null;

        while ((match = stepRefPattern.exec(line)) !== null) {
            const stepId = match[1];
            const outputPath = match[2];
            const fullVariable = match[0];

            // 检查步骤是否存在
            if (!steps.find((step) => step.id === stepId)) {
                errors.push(
                    `第${lineNumber}行: 符咒「${fullVariable}」引用了虚无步骤「${stepId}」，此步骤并不存在于仙法序列中`,
                );
                continue;
            }

            // 检查是否有 output_schema 定义
            const schema = stepSchemas.get(stepId);
            if (!schema) {
                errors.push(
                    `第${lineNumber}行: 步骤「${stepId}」未书写output_schema典制，无法验证输出符路「${outputPath}」是否通达`,
                );
                continue;
            }

            // 验证输出路径是否存在于 schema 中
            if (!validateOutputPath(schema, outputPath.split("."))) {
                const availablePaths = getAvailablePaths(schema);
                errors.push(
                    `第${lineNumber}行: 步骤「${stepId}」中符路「${outputPath}」不通，` +
                        `可行符路: ${availablePaths.join(", ")}`,
                );
            }
        }
    }

    return errors;
}

/**
 * 验证条件语法格式
 */
function validateConditionSyntax(workflow: any, content: string): string[] {
    const errors: string[] = [];
    const lines = content.split("\n");

    function validateCondition(condition: any, stepName: string, lineNumber: number) {
        if (!condition || typeof condition !== "object") return;

        // 检查是否使用了错误的RFC语法 (value/test 而不是 field/operator/value)
        if ("test" in condition && !("field" in condition)) {
            errors.push(
                `第${lineNumber}行: 步骤「${stepName}」条件使用了错误的RFC语法，应使用 field/operator/value 格式，而不是 value/test 格式`,
            );
        }

        // 检查是否缺少必要字段
        if ("operator" in condition) {
            if (!("field" in condition) && !("value" in condition)) {
                errors.push(
                    `第${lineNumber}行: 步骤「${stepName}」条件缺少必要的 field 或 value 字段`,
                );
            }
        }

        // 递归检查嵌套条件
        if (condition.conditions && Array.isArray(condition.conditions)) {
            condition.conditions.forEach((nestedCondition: any) => {
                validateCondition(nestedCondition, stepName, lineNumber);
            });
        }
    }

    if (workflow.steps && Array.isArray(workflow.steps)) {
        workflow.steps.forEach((step: any, _index: number) => {
            const stepLineNumber =
                lines.findIndex(
                    (line) => line.includes(`id: "${step.id}"`) || line.includes(`id: ${step.id}`),
                ) + 1;

            if (step.condition) {
                validateCondition(step.condition, step.name || step.id, stepLineNumber);
            }

            // 检查 onTrue/onFalse 中的条件
            ["onTrue", "onFalse"].forEach((branch) => {
                if (step[branch] && Array.isArray(step[branch])) {
                    step[branch].forEach((subStep: any) => {
                        if (subStep.condition) {
                            validateCondition(
                                subStep.condition,
                                subStep.name || subStep.id,
                                stepLineNumber,
                            );
                        }
                    });
                }
            });
        });
    }

    return errors;
}

/**
 * 验证输出路径是否存在于schema中
 */
function validateOutputPath(schema: any, pathParts: string[]): boolean {
    let current = schema;

    for (const part of pathParts) {
        if (current && typeof current === "object" && part in current) {
            current = current[part];
        } else {
            return false;
        }
    }

    return true;
}

/**
 * 获取schema中所有可用的路径
 */
function getAvailablePaths(schema: any, prefix = ""): string[] {
    const paths: string[] = [];

    if (schema && typeof schema === "object") {
        for (const key of Object.keys(schema)) {
            const currentPath = prefix ? `${prefix}.${key}` : key;
            paths.push(currentPath);

            // 递归获取嵌套路径
            if (typeof schema[key] === "object" && schema[key] !== null) {
                paths.push(...getAvailablePaths(schema[key], currentPath));
            }
        }
    }

    return paths;
}

/**
 * 验证单个工作流文件
 */
function validateWorkflowFile(filePath: string): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
        // 读取和解析YAML文件
        const content = fs.readFileSync(filePath, "utf8");
        const workflow = yaml.load(content) as WorkflowDefinition;

        if (!workflow || typeof workflow !== "object") {
            errors.push("无效的YAML典籍格式或空卷");
            return { errors, warnings };
        }

        // 验证模板变量格式（基于原始文件内容）
        errors.push(...validateTemplateVariables(content, filePath));

        // 验证工作流必需字段
        errors.push(...validateWorkflowRequired(workflow, filePath));

        // 验证每个步骤
        if (workflow.steps && Array.isArray(workflow.steps)) {
            // 验证步骤间的变量路径语义
            const semanticErrors = validateStepOutputReferences(workflow.steps, content, filePath);

            // 验证条件语法格式
            const conditionErrors = validateConditionSyntax(workflow, content);

            // 将缺少output_schema的情况归类为警告而非错误
            const missingSchemaErrors = semanticErrors.filter((err) =>
                err.includes("未定义output_schema"),
            );
            const realErrors = semanticErrors.filter((err) => !err.includes("未定义output_schema"));

            errors.push(...realErrors);
            errors.push(...conditionErrors);
            warnings.push(...missingSchemaErrors);
        }
    } catch (error) {
        errors.push(`YAML典籍解析错误: ${(error as Error).message}`);
    }

    return { errors, warnings };
}

/**
 * 验证选项接口
 */
interface ValidateOptions {
    dir: string;
    fix: boolean;
    verbose: boolean;
    format: "table" | "json" | "simple";
    strict: boolean;
    filterLevel: "all" | "error" | "warning";
}

/**
 * 主验证函数
 */
async function validateWorkflows(options: ValidateOptions) {
    const {
        dir: workflowDir,
        fix: fixMode,
        verbose: verboseMode,
        format,
        strict,
        _filterLevel,
    } = options;

    // 显示工具标题
    console.log(
        `\n${boxen("🌌 天枢仙府 · 工作流秘籍验证阵法", {
            padding: 1,
            borderStyle: "double",
            borderColor: "magenta",
        })}\n`,
    );

    if (!fs.existsSync(workflowDir)) {
        console.error(chalk.red(`❌ 仙府秘库不存: ${workflowDir}`));
        process.exit(1);
    }

    // 显示扫描信息
    console.log(chalk.blue(`🏔️ 神识探查仙府秘库: ${workflowDir}`));

    // 使用loading动画
    const spinner = ora("🔮 神识扫描，搜寻秘籍真传...").start();

    const pattern = path.join(workflowDir, "**/*.{yml,yaml}").replace(/\\/g, "/");
    const workflowFiles = await glob(pattern);

    if (workflowFiles.length === 0) {
        spinner.fail(chalk.yellow(`仙府秘库 ${workflowDir} 中未寻得功法秘籍`));
        process.exit(0);
    }

    spinner.succeed(chalk.green(`✨ 神识探得功法秘籍 ${workflowFiles.length} 卷`));

    const allErrors: { file: string; errors: string[]; warnings: string[] }[] = [];
    let totalErrors = 0;
    let totalWarnings = 0;

    // 验证文件的进度动画
    const validationSpinner = ora("⚡ 施展天眼神通，检验秘籍真伪...").start();

    for (const filePath of workflowFiles) {
        const relativePath = path.relative(process.cwd(), filePath);
        validationSpinner.text = `🔍 天眼检验: ${path.basename(relativePath)}`;

        const result = validateWorkflowFile(filePath);

        // 总是添加有问题的文件到结果中（不管过滤级别）
        if (result.errors.length > 0 || result.warnings.length > 0) {
            allErrors.push({
                file: relativePath,
                errors: result.errors,
                warnings: result.warnings,
            });
        }

        totalErrors += result.errors.length;
        totalWarnings += result.warnings.length;

        if (verboseMode) {
            if (result.errors.length === 0 && result.warnings.length === 0) {
                console.log(chalk.green(`    ✨ ${relativePath} 秘籍真传，无虞`));
            } else {
                console.log(
                    chalk.red(
                        `    💥 ${relativePath} (${result.errors.length} 心魔, ${result.warnings.length} 杂念)`,
                    ),
                );
            }
        }
    }

    validationSpinner.succeed("🎊 天眼神通施展完毕");

    // 输出结果
    console.log("\n");

    if (totalErrors === 0 && totalWarnings === 0) {
        console.log(
            boxen("🌟 诸秘籍皆合天道，功法无瑕！仙缘深厚！", {
                padding: 1,
                borderStyle: "double",
                borderColor: "green",
            }),
        );
        process.exit(0);
    }

    // 根据格式输出结果
    switch (format) {
        case "json":
            outputJSON({ allErrors, totalErrors, totalWarnings, workflowFiles });
            break;
        case "table":
            outputTable({ allErrors, totalErrors, totalWarnings, workflowFiles });
            break;
        default:
            outputSimple({ allErrors, totalErrors, totalWarnings, workflowFiles, fixMode });
    }

    // 如果有错误，退出码为1；在严格模式下，警告也视为错误
    const exitCode = (strict && totalWarnings > 0) || totalErrors > 0 ? 1 : 0;
    process.exit(exitCode);
}

/**
 * 输出JSON格式结果
 */
function outputJSON(data: {
    allErrors: any[];
    totalErrors: number;
    totalWarnings: number;
    workflowFiles: string[];
}) {
    const result = {
        summary: {
            totalFiles: data.workflowFiles.length,
            filesWithIssues: data.allErrors.length,
            totalErrors: data.totalErrors,
            totalWarnings: data.totalWarnings,
            timestamp: new Date().toISOString(),
        },
        details: data.allErrors,
    };
    console.log(JSON.stringify(result, null, 2));
}

/**
 * 输出表格格式结果
 */
function outputTable(data: {
    allErrors: any[];
    totalErrors: number;
    totalWarnings: number;
    workflowFiles: string[];
}) {
    console.log(chalk.bold("\n📊 典籍校验汇总表\n"));

    const table = new Table({
        head: [chalk.cyan("典籍名"), chalk.red("谬误"), chalk.yellow("疑议"), chalk.blue("状态")],
        colWidths: [50, 8, 8, 10],
    });

    data.allErrors.forEach(({ file, errors, warnings }) => {
        const status = errors.length > 0 ? chalk.red("有误") : chalk.yellow("存疑");
        table.push([
            path.basename(file),
            errors.length.toString(),
            warnings.length.toString(),
            status,
        ]);
    });

    console.log(table.toString());

    // 统计信息
    console.log(`\n${chalk.bold("📈 总览:")}`);
    console.log(`  典籍总数: ${chalk.blue(data.workflowFiles.length)}`);
    console.log(`  有问题典籍: ${chalk.red(data.allErrors.length)}`);
    console.log(`  谬误总数: ${chalk.red(data.totalErrors)}`);
    console.log(`  疑议总数: ${chalk.yellow(data.totalWarnings)}`);
}

/**
 * 输出简单格式结果
 */
function outputSimple(data: {
    allErrors: any[];
    totalErrors: number;
    totalWarnings: number;
    workflowFiles: string[];
    fixMode: boolean;
}) {
    console.log(chalk.bold("\n📊 典籍校验结果\n"));

    // 输出详细错误
    data.allErrors.forEach(({ file, errors, warnings }) => {
        console.log(chalk.bold(`\n📄 ${file}`));

        if (errors.length > 0) {
            console.log(chalk.red(`  谬误 (${errors.length}):`));
            errors.forEach((error: string, index: number) => {
                console.log(chalk.red(`    ${index + 1}. ${error}`));
            });
        }

        if (warnings.length > 0) {
            console.log(chalk.yellow(`  疑议 (${warnings.length}):`));
            warnings.forEach((warning: string, index: number) => {
                console.log(chalk.yellow(`    ${index + 1}. ${warning}`));
            });
        }
    });

    console.log(chalk.bold(`\n📈 总览:`));
    console.log(chalk.blue(`  典籍数: ${data.workflowFiles.length}`));
    console.log(chalk.red(`  有问题的典籍: ${data.allErrors.length}`));
    console.log(chalk.red(`  谬误总数: ${data.totalErrors}`));
    console.log(chalk.yellow(`  疑议总数: ${data.totalWarnings}`));

    if (data.fixMode) {
        console.log(chalk.yellow("\n🔧 自动修复功能尚未实现"));
    }

    console.log(chalk.bold("\n💡 建议:"));
    console.log(chalk.cyan("  1. 为缺少output_schema的步骤添加输出结构声明"));
    console.log(chalk.cyan("  2. 修复无效的符路引用"));
    console.log(chalk.cyan("  3. 确保所有符咒使用{{}}格式"));
}

/**
 * 配置Commander程序
 */
function setupProgram(): Command {
    const program = new Command();

    program
        .name("validate-workflows")
        .description("🌌 天枢工作流典籍校验司 - 专业的YAML工作流验证工具")
        .version("1.0.0");

    program
        .option("-d, --dir <path>", "指定典籍库目录", "src/engines/tianshu/workflows")
        .option("-f, --fix", "尝试自动修复常见问题", false)
        .option("-v, --verbose", "显示详细输出", false)
        .option("--format <type>", "输出格式 (simple|table|json)", "simple")
        .option("--strict", "严格模式：警告也视为错误", false)
        .option("--filter <level>", "过滤级别 (all|error|warning)", "all")
        .action(async (options) => {
            const resolvedOptions: ValidateOptions = {
                ...options,
                dir: path.resolve(process.cwd(), options.dir),
            };
            await validateWorkflows(resolvedOptions);
        });

    return program;
}

// 运行主函数
if (require.main === module) {
    const program = setupProgram();
    program.parse(process.argv);
}
