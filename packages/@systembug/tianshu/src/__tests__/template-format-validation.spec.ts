/**
 * 模板格式验证测试
 * 验证RFC合规性测试能够正确检测出模板格式错误
 */

// 由于validateTemplateVariables不是导出函数，我们需要直接复制实现
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
                `第${lineNumber}行: 发现错误的模板变量格式 "${dollarMatches.join(", ")}"，` +
                    `RFC 0037要求使用花括号格式而不是美元符号格式`,
            );
        }

        // 检查正确的{{}}格式中的语法错误
        const templatePattern = /\{\{([^}]*)\}\}/g;
        let match;
        while ((match = templatePattern.exec(line)) !== null) {
            const variableContent = match[1].trim();

            // 检查空变量
            if (!variableContent) {
                errors.push(`第${lineNumber}行: 发现空的模板变量 "{{}}"，变量内容不能为空`);
                continue;
            }

            // 检查变量路径格式
            if (variableContent.includes("steps.")) {
                // 验证步骤变量路径格式: steps.stepId.output.field 或 steps.stepId.field
                const stepPathPattern =
                    /^steps\.([a-zA-Z_][a-zA-Z0-9_]*)(\.output)?(\.[a-zA-Z_][a-zA-Z0-9_.]*)$/;
                if (!stepPathPattern.test(variableContent)) {
                    errors.push(
                        `第${lineNumber}行: 步骤变量路径格式错误 "{{${variableContent}}}"，` +
                            `正确格式应为: steps.stepId.output.field 或 steps.stepId.field`,
                    );
                }

                // 检查是否有双重.output路径（常见错误）
                if (variableContent.includes(".output.output")) {
                    errors.push(
                        `第${lineNumber}行: 发现双重.output路径 "{{${variableContent}}}"，` +
                            `这通常是批量替换错误导致的`,
                    );
                }
            } else if (variableContent.includes("input.")) {
                // 验证输入变量路径格式: input.fieldName
                const inputPathPattern = /^input\.[a-zA-Z_][a-zA-Z0-9_.]*$/;
                if (!inputPathPattern.test(variableContent)) {
                    errors.push(
                        `第${lineNumber}行: 输入变量路径格式错误 "{{${variableContent}}}"，` +
                            `正确格式应为: input.fieldName`,
                    );
                }
            }

            // 检查函数调用格式（允许复杂的表达式，如Object.keys()、Date.now()等）
            if (variableContent.includes("(") && variableContent.includes(")")) {
                // 允许更复杂的函数调用模式，包括：
                // - 简单函数调用: functionName()
                // - 方法调用: Object.keys(), Date.now()
                // - 属性访问后的方法调用: step.result.method()
                const complexFunctionPattern = /^[a-zA-Z_][a-zA-Z0-9_.]*\([^)]*\).*$/;
                if (!complexFunctionPattern.test(variableContent)) {
                    errors.push(
                        `第${lineNumber}行: 函数调用格式错误 "{{${variableContent}}}"，` +
                            `请检查括号匹配和函数名称格式`,
                    );
                }
            }
        }
    }

    return errors;
}

describe("模板格式验证测试", () => {
    describe("错误的${}格式检测", () => {
        it("应该检测出错误的${}格式", () => {
            const content = `
input:
  data: "\${input.invalidFormat}"
  value: "\${steps.step1.result}"
            `;

            const errors = validateTemplateVariables(content, "test.yml");

            expect(errors).toHaveLength(2);
            expect(errors[0]).toContain("错误的模板变量格式");
            expect(errors[0]).toContain("input.invalidFormat");
            expect(errors[1]).toContain("steps.step1.result");
        });
    });

    describe("空变量检测", () => {
        it("应该检测出空的模板变量", () => {
            const content = `
input:
  data: "{{}}"
  value: "{{ }}"
            `;

            const errors = validateTemplateVariables(content, "test.yml");

            expect(errors).toHaveLength(2);
            expect(errors[0]).toContain("发现空的模板变量");
            expect(errors[1]).toContain("发现空的模板变量");
        });
    });

    describe("双重.output路径检测", () => {
        it("应该检测出双重.output路径", () => {
            const content = `
input:
  data: "{{steps.validate_step.output.output.errors}}"
  result: "{{steps.process_step.output.output.success}}"
            `;

            const errors = validateTemplateVariables(content, "test.yml");

            expect(errors).toHaveLength(2);
            expect(errors[0]).toContain("发现双重.output路径");
            expect(errors[0]).toContain("steps.validate_step.output.output.errors");
            expect(errors[1]).toContain("steps.process_step.output.output.success");
        });
    });

    describe("步骤变量路径格式检测", () => {
        it("应该检测出错误的步骤变量路径", () => {
            const content = `
input:
  data: "{{steps.}}"
  result: "{{steps..output.value}}"
  invalid: "{{steps.123invalid.result}}"
            `;

            const errors = validateTemplateVariables(content, "test.yml");

            expect(errors.length).toBeGreaterThan(0);
            expect(errors.some((err) => err.includes("步骤变量路径格式错误"))).toBe(true);
        });

        it("应该允许正确的步骤变量路径", () => {
            const content = `
input:
  data: "{{steps.validate_step.output.result}}"
  result: "{{steps.process_step.success}}"
  value: "{{steps.step_1.output.data.value}}"
            `;

            const errors = validateTemplateVariables(content, "test.yml");

            expect(errors).toHaveLength(0);
        });
    });

    describe("输入变量路径格式检测", () => {
        it("应该检测出错误的输入变量路径", () => {
            const content = `
input:
  data: "{{input.}}"
  result: "{{input..value}}"
  invalid: "{{input.123invalid}}"
            `;

            const errors = validateTemplateVariables(content, "test.yml");

            expect(errors.length).toBeGreaterThan(0);
            expect(errors.some((err) => err.includes("输入变量路径格式错误"))).toBe(true);
        });

        it("应该允许正确的输入变量路径", () => {
            const content = `
input:
  data: "{{input.delta}}"
  result: "{{input.source}}"
  value: "{{input.config.setting}}"
            `;

            const errors = validateTemplateVariables(content, "test.yml");

            expect(errors).toHaveLength(0);
        });
    });

    describe("函数调用格式检测", () => {
        it("应该允许正确的函数调用", () => {
            const content = `
input:
  timestamp: "{{Date.now()}}"
  keys: "{{Object.keys(data).length}}"
  result: "{{step.method()}}"
  complex: "{{Object.keys(step.get_all_engine_status.output.allStatus).length}}"
            `;

            const errors = validateTemplateVariables(content, "test.yml");

            expect(errors).toHaveLength(0);
        });

        it("应该检测出格式错误的函数调用", () => {
            const content = `
input:
  invalid1: "{{123invalid()}}"
  invalid2: "{{func(}}"
  invalid3: "{{func)}}"
            `;

            const errors = validateTemplateVariables(content, "test.yml");

            expect(errors.length).toBeGreaterThan(0);
            expect(errors.some((err) => err.includes("函数调用格式错误"))).toBe(true);
        });
    });

    describe("综合格式验证", () => {
        it("应该检测出多种格式错误的组合", () => {
            const content = `
id: "test_workflow"
steps:
  - input:
      data: "\${input.wrong}"          # 错误的美元符号格式
      empty: "{{}}"                   # 空变量
      double: "{{steps.step1.output.output.result}}"  # 双重.output
      bad_path: "{{steps..result}}"   # 错误的路径格式
      bad_func: "{{123func()}}"       # 错误的函数调用
      good: "{{input.valid}}"         # 正确格式
            `;

            const errors = validateTemplateVariables(content, "test.yml");

            expect(errors.length).toBeGreaterThanOrEqual(5);
            expect(errors.some((err) => err.includes("错误的模板变量格式"))).toBe(true);
            expect(errors.some((err) => err.includes("发现空的模板变量"))).toBe(true);
            expect(errors.some((err) => err.includes("发现双重.output路径"))).toBe(true);
            expect(errors.some((err) => err.includes("步骤变量路径格式错误"))).toBe(true);
            expect(errors.some((err) => err.includes("函数调用格式错误"))).toBe(true);
        });
    });
});
