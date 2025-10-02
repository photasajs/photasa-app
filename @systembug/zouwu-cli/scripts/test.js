#!/usr/bin/env node

/**
 * 🌌 天枢工作流Schema包测试脚本
 *
 * 📜 仙术功能：运行基础功能测试，验证Schema和生成器正确性
 * 🔧 工作流操作：自动化测试流程
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("🌌 启动天枢Schema包测试仙术...");

const rootDir = path.join(__dirname, "..");
const testDir = path.join(rootDir, "test-output");

// 🔧 清理测试目录
function cleanTestDir() {
    console.log("📜 清理测试目录...");
    try {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        fs.mkdirSync(testDir, { recursive: true });
    } catch (error) {
        console.error("❌ 清理测试目录失败:", error);
        process.exit(1);
    }
}

// 🌌 测试Schema文件完整性
function testSchemaFiles() {
    console.log("📜 测试Schema文件完整性...");

    const schemasDir = path.join(rootDir, "schemas");
    const expectedSchemas = [
        "workflow.schema.json",
        "step-types.schema.json",
        "template-syntax.schema.json",
    ];

    let passed = 0;
    let failed = 0;

    for (const schemaFile of expectedSchemas) {
        const schemaPath = path.join(schemasDir, schemaFile);

        try {
            if (!fs.existsSync(schemaPath)) {
                console.error(`❌ Schema文件不存在: ${schemaFile}`);
                failed++;
                continue;
            }

            const schemaContent = fs.readFileSync(schemaPath, "utf-8");
            const schema = JSON.parse(schemaContent);

            // 验证基本字段
            if (!schema.$schema) {
                console.error(`❌ ${schemaFile}: 缺少$schema字段`);
                failed++;
                continue;
            }

            if (!schema.$id) {
                console.error(`❌ ${schemaFile}: 缺少$id字段`);
                failed++;
                continue;
            }

            if (!schema.title) {
                console.error(`❌ ${schemaFile}: 缺少title字段`);
                failed++;
                continue;
            }

            console.log(`✅ ${schemaFile}: Schema格式正确`);
            passed++;
        } catch (error) {
            console.error(`❌ ${schemaFile}: ${error.message}`);
            failed++;
        }
    }

    console.log(`📊 Schema测试结果: ${passed} 通过, ${failed} 失败`);
    return failed === 0;
}

// 🔧 测试TypeScript编译
function testTypeScriptCompilation() {
    console.log("📜 测试TypeScript编译...");

    try {
        execSync("npx tsc --noEmit", {
            cwd: rootDir,
            stdio: "pipe",
        });
        console.log("✅ TypeScript编译检查通过");
        return true;
    } catch (error) {
        console.error("❌ TypeScript编译检查失败:", error.stdout?.toString() || error.message);
        return false;
    }
}

// 🌌 测试代码生成器
function testGenerators() {
    console.log("📜 测试代码生成器...");

    try {
        // 编译TypeScript到测试目录
        const tsBuildDir = path.join(testDir, "build");
        fs.mkdirSync(tsBuildDir, { recursive: true });

        execSync(`npx tsc --outDir ${tsBuildDir}`, {
            cwd: rootDir,
            stdio: "pipe",
        });

        // 复制schemas到构建目录
        const schemasSource = path.join(rootDir, "schemas");
        const schemasDest = path.join(tsBuildDir, "schemas");

        if (fs.existsSync(schemasSource)) {
            fs.mkdirSync(schemasDest, { recursive: true });
            const schemaFiles = fs.readdirSync(schemasSource);
            for (const file of schemaFiles) {
                if (file.endsWith(".json")) {
                    fs.copyFileSync(path.join(schemasSource, file), path.join(schemasDest, file));
                }
            }
        }

        // 测试类型生成器
        console.log("🔧 测试类型生成器...");
        const { generateTypesFromSchema } = require(
            path.join(tsBuildDir, "generators/schema-to-types"),
        );

        const workflowSchemaPath = path.join(schemasDest, "workflow.schema.json");
        const typesOutputPath = path.join(testDir, "workflow.types.ts");

        generateTypesFromSchema({
            schemaPath: workflowSchemaPath,
            outputPath: typesOutputPath,
            generateDocs: true,
        })
            .then(() => {
                if (fs.existsSync(typesOutputPath)) {
                    console.log("✅ 类型生成器测试通过");
                } else {
                    console.error("❌ 类型生成器未产生输出文件");
                    return false;
                }
            })
            .catch((error) => {
                console.error("❌ 类型生成器测试失败:", error);
                return false;
            });

        // 测试验证器生成器
        console.log("🔧 测试验证器生成器...");
        const { generateValidatorsFromSchema } = require(
            path.join(tsBuildDir, "generators/schema-to-validators"),
        );

        const validatorsOutputPath = path.join(testDir, "workflow.validators.ts");

        generateValidatorsFromSchema({
            schemaPath: workflowSchemaPath,
            outputPath: validatorsOutputPath,
            strict: true,
            chineseErrors: true,
        })
            .then(() => {
                if (fs.existsSync(validatorsOutputPath)) {
                    console.log("✅ 验证器生成器测试通过");
                } else {
                    console.error("❌ 验证器生成器未产生输出文件");
                    return false;
                }
            })
            .catch((error) => {
                console.error("❌ 验证器生成器测试失败:", error);
                return false;
            });

        return true;
    } catch (error) {
        console.error("❌ 代码生成器测试失败:", error);
        return false;
    }
}

// 🔧 测试工作流验证器
function testWorkflowValidator() {
    console.log("📜 测试工作流验证器...");

    // 创建测试工作流
    const validWorkflow = {
        id: "test_workflow",
        name: "测试工作流",
        version: "1.0.0",
        steps: [
            {
                id: "test_step",
                type: "builtin",
                action: "return",
                input: {
                    success: true,
                    message: "Hello World",
                },
            },
        ],
    };

    const invalidWorkflow = {
        // 缺少必需字段
        name: "无效工作流",
    };

    try {
        // 需要先编译代码
        const tsBuildDir = path.join(testDir, "build");
        const { validateWorkflow } = require(path.join(tsBuildDir, "validators"));

        // 测试有效工作流
        const validResult = validateWorkflow(validWorkflow);
        if (validResult.valid) {
            console.log("✅ 有效工作流验证通过");
        } else {
            console.error("❌ 有效工作流验证失败:", validResult.errors);
            return false;
        }

        // 测试无效工作流
        const invalidResult = validateWorkflow(invalidWorkflow);
        if (!invalidResult.valid && invalidResult.errors.length > 0) {
            console.log("✅ 无效工作流正确被拒绝");
        } else {
            console.error("❌ 无效工作流未被正确拒绝");
            return false;
        }

        return true;
    } catch (error) {
        console.error("❌ 工作流验证器测试失败:", error);
        return false;
    }
}

// 🌌 创建示例文件
function createExamples() {
    console.log("📜 创建示例文件...");

    try {
        const examplesDir = path.join(testDir, "examples");
        fs.mkdirSync(examplesDir, { recursive: true });

        // 创建示例工作流
        const exampleWorkflow = {
            id: "example_preference_update",
            name: "偏好设置更新示例",
            description: "展示如何更新用户偏好设置",
            version: "1.0.0",
            author: "天枢引擎",
            triggers: [{ intent: "update_preferences" }],
            inputs: [
                {
                    name: "delta",
                    type: "object",
                    required: true,
                    description: "偏好设置变更数据",
                },
            ],
            outputs: [
                {
                    name: "success",
                    type: "boolean",
                    description: "操作是否成功",
                },
                {
                    name: "data",
                    type: "object",
                    description: "更新后的数据",
                },
            ],
            steps: [
                {
                    id: "validate_input",
                    type: "condition",
                    description: "验证输入数据",
                    condition: {
                        operator: "exists",
                        value: "{{inputs.delta}}",
                    },
                    onTrue: [
                        {
                            id: "update_preferences",
                            type: "action",
                            service: "wenchang",
                            action: "applyDelta",
                            input: {
                                delta: "{{inputs.delta}}",
                            },
                            output: {
                                revision: "result.revision",
                                data: "result.data",
                            },
                            output_schema: {
                                type: "object",
                                properties: {
                                    revision: { type: "string" },
                                    data: { type: "object" },
                                },
                            },
                        },
                    ],
                    onFalse: [
                        {
                            id: "return_error",
                            type: "builtin",
                            action: "error",
                            input: {
                                message: "输入数据无效",
                                code: "INVALID_INPUT",
                            },
                        },
                    ],
                },
                {
                    id: "return_success",
                    type: "builtin",
                    action: "return",
                    input: {
                        success: true,
                        data: "{{steps.update_preferences.output.data}}",
                        revision: "{{steps.update_preferences.output.revision}}",
                    },
                    dependsOn: ["validate_input"],
                },
            ],
        };

        fs.writeFileSync(
            path.join(examplesDir, "example-workflow.json"),
            JSON.stringify(exampleWorkflow, null, 2),
        );

        console.log("✅ 示例文件创建完成");
        return true;
    } catch (error) {
        console.error("❌ 示例文件创建失败:", error);
        return false;
    }
}

// 🌌 主测试流程
async function main() {
    const results = [];

    try {
        cleanTestDir();

        results.push({ name: "Schema文件完整性", passed: testSchemaFiles() });
        results.push({ name: "TypeScript编译", passed: testTypeScriptCompilation() });

        // 给生成器测试一点时间
        setTimeout(() => {
            results.push({ name: "代码生成器", passed: testGenerators() });
            results.push({ name: "工作流验证器", passed: testWorkflowValidator() });
            results.push({ name: "示例文件创建", passed: createExamples() });

            // 输出测试结果
            console.log("\n🌌 天枢Schema包测试结果总览:");
            console.log("=".repeat(50));

            let totalPassed = 0;
            let totalFailed = 0;

            for (const result of results) {
                const status = result.passed ? "✅" : "❌";
                console.log(`${status} ${result.name}`);
                if (result.passed) {
                    totalPassed++;
                } else {
                    totalFailed++;
                }
            }

            console.log("=".repeat(50));
            console.log(`📊 总计: ${totalPassed} 通过, ${totalFailed} 失败`);

            if (totalFailed === 0) {
                console.log("🌌 所有测试通过，仙术圆满！");
                process.exit(0);
            } else {
                console.log("❌ 发现问题，需要修复");
                process.exit(1);
            }
        }, 2000);
    } catch (error) {
        console.error("❌ 天劫降临，测试失败:", error);
        process.exit(1);
    }
}

// 执行测试
main();
