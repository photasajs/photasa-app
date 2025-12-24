/**
 * 📜 表达式解析器单元测试
 *
 * 🌌 测试模板表达式解析功能
 */

import {
    parseTemplateExpression,
    extractTemplateExpressions,
    extractTemplateExpressionsFromObject,
    hasTemplateExpression,
    getAllVariableReferences,
} from '../parser';

describe('parseTemplateExpression', () => {
    describe('简单变量引用', () => {
        it('应该解析 inputs 变量', () => {
            const result = parseTemplateExpression('{{inputs.userName}}', 'inputs.userName');
            expect(result).not.toBeNull();
            expect(result?.type).toBe('inputs');
            expect(result?.path).toBe('userName');
            expect(result?.hasDefault).toBe(false);
        });

        it('应该解析 variables 变量', () => {
            const result = parseTemplateExpression(
                '{{variables.requestId}}',
                'variables.requestId'
            );
            expect(result).not.toBeNull();
            expect(result?.type).toBe('variables');
            expect(result?.path).toBe('requestId');
        });

        it('应该解析嵌套属性', () => {
            const result = parseTemplateExpression(
                '{{inputs.user.profile.name}}',
                'inputs.user.profile.name'
            );
            expect(result).not.toBeNull();
            expect(result?.type).toBe('inputs');
            expect(result?.path).toBe('user.profile.name');
        });

        it('应该解析数组索引', () => {
            const result = parseTemplateExpression(
                '{{inputs.files[0].name}}',
                'inputs.files[0].name'
            );
            expect(result).not.toBeNull();
            expect(result?.type).toBe('inputs');
            expect(result?.path).toBe('files[0].name');
        });
    });

    describe('步骤输出引用', () => {
        it('应该解析步骤输出', () => {
            const result = parseTemplateExpression(
                '{{steps.stepId.output}}',
                'steps.stepId.output'
            );
            expect(result).not.toBeNull();
            expect(result?.type).toBe('steps');
            expect(result?.path).toBe('stepId.output');
        });

        it('应该解析步骤输出的嵌套属性', () => {
            const result = parseTemplateExpression(
                '{{steps.validate.output.result}}',
                'steps.validate.output.result'
            );
            expect(result).not.toBeNull();
            expect(result?.type).toBe('steps');
            expect(result?.path).toBe('validate.output.result');
        });
    });

    describe('带默认值的变量', () => {
        it('应该解析带字符串默认值的变量', () => {
            const result = parseTemplateExpression(
                "{{inputs.name || 'default'}}",
                "inputs.name || 'default'"
            );
            expect(result).not.toBeNull();
            expect(result?.type).toBe('inputs');
            expect(result?.path).toBe('name');
            expect(result?.hasDefault).toBe(true);
            expect(result?.defaultValue).toBe('default');
        });

        it('应该解析带数字默认值的变量', () => {
            const result = parseTemplateExpression(
                '{{variables.count || 0}}',
                'variables.count || 0'
            );
            expect(result).not.toBeNull();
            expect(result?.hasDefault).toBe(true);
            expect(result?.defaultValue).toBe(0);
        });

        it('应该解析带布尔默认值的变量', () => {
            const result = parseTemplateExpression(
                '{{inputs.enabled || false}}',
                'inputs.enabled || false'
            );
            expect(result).not.toBeNull();
            expect(result?.hasDefault).toBe(true);
            expect(result?.defaultValue).toBe(false);
        });
    });

    describe('循环变量', () => {
        it('应该解析 currentFile', () => {
            const result = parseTemplateExpression('{{currentFile}}', 'currentFile');
            expect(result).not.toBeNull();
            expect(result?.type).toBe('loopContext');
            expect(result?.path).toBe('currentFile');
        });

        it('应该解析 fileIndex', () => {
            const result = parseTemplateExpression('{{fileIndex}}', 'fileIndex');
            expect(result).not.toBeNull();
            expect(result?.type).toBe('loopContext');
            expect(result?.path).toBe('fileIndex');
        });

        it('应该解析 loopContext 变量', () => {
            const result = parseTemplateExpression('{{loopContext.index}}', 'loopContext.index');
            expect(result).not.toBeNull();
            expect(result?.type).toBe('loopContext');
            expect(result?.path).toBe('index');
        });
    });

    describe('复杂表达式', () => {
        it('应该处理 JavaScript 表达式', () => {
            const result = parseTemplateExpression('{{Date.now()}}', 'Date.now()');
            expect(result).not.toBeNull();
            // 复杂表达式可能无法完全解析，但应该返回基本信息
            expect(result?.expression).toBe('Date.now()');
        });

        it('应该处理三元表达式', () => {
            const result = parseTemplateExpression(
                "{{inputs.type === 'admin' ? 'full' : 'limited'}}",
                "inputs.type === 'admin' ? 'full' : 'limited'"
            );
            expect(result).not.toBeNull();
            expect(result?.expression).toContain('inputs.type');
        });
    });
});

describe('extractTemplateExpressions', () => {
    it('应该从简单字符串中提取表达式', () => {
        const result = extractTemplateExpressions('Hello {{inputs.name}}!');
        expect(result.hasTemplate).toBe(true);
        expect(result.variables).toHaveLength(1);
        expect(result.variables[0].type).toBe('inputs');
        expect(result.variables[0].path).toBe('name');
    });

    it('应该提取多个表达式', () => {
        const result = extractTemplateExpressions('{{inputs.name}} is {{inputs.age}} years old');
        expect(result.hasTemplate).toBe(true);
        expect(result.variables).toHaveLength(2);
        expect(result.expressions).toHaveLength(2);
    });

    it('应该处理没有模板的字符串', () => {
        const result = extractTemplateExpressions('Hello World');
        expect(result.hasTemplate).toBe(false);
        expect(result.variables).toHaveLength(0);
    });

    it('应该提取带默认值的表达式', () => {
        const result = extractTemplateExpressions("{{inputs.name || 'Guest'}}");
        expect(result.hasTemplate).toBe(true);
        expect(result.variables[0].hasDefault).toBe(true);
        expect(result.variables[0].defaultValue).toBe('Guest');
    });

    it('应该保留原始字符串', () => {
        const text = 'Hello {{inputs.name}}!';
        const result = extractTemplateExpressions(text);
        expect(result.original).toBe(text);
    });
});

describe('extractTemplateExpressionsFromObject', () => {
    it('应该从对象中提取表达式', () => {
        const obj = {
            message: 'Hello {{inputs.name}}!',
            count: 42,
        };
        const results = extractTemplateExpressionsFromObject(obj);
        expect(results).toHaveLength(1);
        expect(results[0].hasTemplate).toBe(true);
    });

    it('应该从嵌套对象中提取表达式', () => {
        const obj = {
            user: {
                greeting: 'Hello {{inputs.name}}!',
                info: 'Age: {{inputs.age}}',
            },
        };
        const results = extractTemplateExpressionsFromObject(obj);
        expect(results.length).toBeGreaterThan(0);
    });

    it('应该从数组中提取表达式', () => {
        const obj = {
            items: ['{{inputs.item1}}', '{{inputs.item2}}', 'static'],
        };
        const results = extractTemplateExpressionsFromObject(obj);
        expect(results.length).toBeGreaterThan(0);
    });

    it('应该处理复杂嵌套结构', () => {
        const obj = {
            workflow: {
                steps: [
                    {
                        input: {
                            message: '{{inputs.message}}',
                        },
                    },
                ],
            },
        };
        const results = extractTemplateExpressionsFromObject(obj);
        expect(results.length).toBeGreaterThan(0);
    });
});

describe('hasTemplateExpression', () => {
    it('应该检测包含模板的字符串', () => {
        expect(hasTemplateExpression('{{inputs.name}}')).toBe(true);
        expect(hasTemplateExpression('Hello {{inputs.name}}!')).toBe(true);
    });

    it('应该检测不包含模板的字符串', () => {
        expect(hasTemplateExpression('Hello World')).toBe(false);
        expect(hasTemplateExpression('')).toBe(false);
    });
});

describe('getAllVariableReferences', () => {
    it('应该去重变量引用', () => {
        const results = [
            extractTemplateExpressions('{{inputs.name}}'),
            extractTemplateExpressions('{{inputs.name}}'),
            extractTemplateExpressions('{{inputs.age}}'),
        ];
        const variables = getAllVariableReferences(results);
        expect(variables).toHaveLength(2);
    });

    it('应该返回所有唯一的变量', () => {
        const results = [
            extractTemplateExpressions('{{inputs.name}}'),
            extractTemplateExpressions('{{variables.id}}'),
            extractTemplateExpressions('{{steps.step1.output}}'),
        ];
        const variables = getAllVariableReferences(results);
        expect(variables).toHaveLength(3);
    });
});
