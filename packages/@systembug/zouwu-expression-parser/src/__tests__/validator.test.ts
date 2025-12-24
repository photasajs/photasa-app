/**
 * 📜 表达式验证器单元测试
 *
 * 🌌 测试模板表达式验证功能
 */

import {
    validateVariableReferences,
    validateTemplateExpression,
    validateTemplateExpressionsInObject,
} from '../validator';
import { TemplateVariableReference } from '../types';

describe('validateVariableReferences', () => {
    it('应该验证有效的变量引用', () => {
        const variables: TemplateVariableReference[] = [
            {
                type: 'inputs',
                path: 'name',
                expression: 'inputs.name',
                hasDefault: false,
            },
        ];
        const availableVars = new Set(['inputs.name', 'inputs.age']);

        const result = validateVariableReferences(variables, availableVars);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('应该检测无效的变量引用', () => {
        const variables: TemplateVariableReference[] = [
            {
                type: 'inputs',
                path: 'nonexistent',
                expression: 'inputs.nonexistent',
                hasDefault: false,
            },
        ];
        const availableVars = new Set(['inputs.name']);

        const result = validateVariableReferences(variables, availableVars);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].message).toContain('未定义的变量');
    });

    it('应该验证嵌套路径', () => {
        const variables: TemplateVariableReference[] = [
            {
                type: 'inputs',
                path: 'user.profile.name',
                expression: 'inputs.user.profile.name',
                hasDefault: false,
            },
        ];
        const availableVars = new Set(['inputs.user']);

        const result = validateVariableReferences(variables, availableVars);
        // 如果基础路径存在，应该通过验证
        expect(result.valid).toBe(true);
    });

    it('应该验证多个变量', () => {
        const variables: TemplateVariableReference[] = [
            {
                type: 'inputs',
                path: 'name',
                expression: 'inputs.name',
                hasDefault: false,
            },
            {
                type: 'inputs',
                path: 'age',
                expression: 'inputs.age',
                hasDefault: false,
            },
            {
                type: 'inputs',
                path: 'invalid',
                expression: 'inputs.invalid',
                hasDefault: false,
            },
        ];
        const availableVars = new Set(['inputs.name', 'inputs.age']);

        const result = validateVariableReferences(variables, availableVars);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBe(1);
    });

    it('应该验证步骤输出变量', () => {
        const variables: TemplateVariableReference[] = [
            {
                type: 'steps',
                path: 'step1.output',
                expression: 'steps.step1.output',
                hasDefault: false,
            },
        ];
        const availableVars = new Set(['steps.step1.output']);

        const result = validateVariableReferences(variables, availableVars);
        expect(result.valid).toBe(true);
    });
});

describe('validateTemplateExpression', () => {
    it('应该验证包含模板的字符串', () => {
        const availableVars = new Set(['inputs.name', 'inputs.age']);
        const result = validateTemplateExpression(
            'Hello {{inputs.name}}, you are {{inputs.age}} years old',
            availableVars
        );
        expect(result.valid).toBe(true);
    });

    it('应该检测无效的变量引用', () => {
        const availableVars = new Set(['inputs.name']);
        const result = validateTemplateExpression('Hello {{inputs.nonexistent}}!', availableVars);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该处理没有模板的字符串', () => {
        const availableVars = new Set(['inputs.name']);
        const result = validateTemplateExpression('Hello World', availableVars);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('应该验证带默认值的表达式', () => {
        const availableVars = new Set(['inputs.name']);
        const result = validateTemplateExpression("{{inputs.name || 'Guest'}}", availableVars);
        // 即使变量存在，带默认值的表达式也应该通过验证
        expect(result.valid).toBe(true);
    });
});

describe('validateTemplateExpressionsInObject', () => {
    it('应该验证对象中的表达式', () => {
        const obj = {
            message: 'Hello {{inputs.name}}!',
            count: 42,
        };
        const availableVars = new Set(['inputs.name']);

        const result = validateTemplateExpressionsInObject(obj, availableVars);
        expect(result.valid).toBe(true);
    });

    it('应该检测对象中的无效表达式', () => {
        const obj = {
            message: 'Hello {{inputs.nonexistent}}!',
        };
        const availableVars = new Set(['inputs.name']);

        const result = validateTemplateExpressionsInObject(obj, availableVars);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该验证嵌套对象', () => {
        const obj = {
            user: {
                greeting: 'Hello {{inputs.name}}!',
                info: 'Age: {{inputs.age}}',
            },
        };
        const availableVars = new Set(['inputs.name', 'inputs.age']);

        const result = validateTemplateExpressionsInObject(obj, availableVars);
        expect(result.valid).toBe(true);
    });

    it('应该验证数组中的表达式', () => {
        const obj = {
            items: ['{{inputs.item1}}', '{{inputs.item2}}'],
        };
        const availableVars = new Set(['inputs.item1', 'inputs.item2']);

        const result = validateTemplateExpressionsInObject(obj, availableVars);
        expect(result.valid).toBe(true);
    });

    it('应该验证复杂嵌套结构', () => {
        const obj = {
            workflow: {
                steps: [
                    {
                        id: 'step1',
                        input: {
                            message: '{{inputs.message}}',
                            count: '{{variables.count}}',
                        },
                    },
                ],
            },
        };
        const availableVars = new Set(['inputs.message', 'variables.count']);

        const result = validateTemplateExpressionsInObject(obj, availableVars);
        expect(result.valid).toBe(true);
    });

    it('应该处理没有表达式的对象', () => {
        const obj = {
            message: 'Hello World',
            count: 42,
        };
        const availableVars = new Set<string>();

        const result = validateTemplateExpressionsInObject(obj, availableVars);
        expect(result.valid).toBe(true);
    });

    it('应该提供错误路径信息', () => {
        const obj = {
            user: {
                name: '{{inputs.invalid}}',
            },
        };
        const availableVars = new Set(['inputs.valid']);

        const result = validateTemplateExpressionsInObject(obj, availableVars);
        expect(result.valid).toBe(false);
        expect(result.errors[0].path).toContain('user');
    });
});
