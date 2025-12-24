import { WorkflowValidator } from '../src/validators';

describe('工作流验证器', () => {
    const validator = new WorkflowValidator();

    test('应该验证有效工作流', () => {
        const validWorkflow = {
            id: 'test_workflow',
            name: '测试工作流',
            version: '1.0.0',
            steps: [
                {
                    id: 'test_step',
                    type: 'builtin',
                    action: 'return',
                    input: {
                        success: true,
                        message: 'Hello World',
                    },
                },
            ],
        };

        const result = validator.validate(validWorkflow);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test('应该拒绝无效工作流', () => {
        const invalidWorkflow = {
            // 缺少必需字段
            name: '无效工作流',
        } as any;

        const result = validator.validate(invalidWorkflow);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });
});
