/**
 * 📜 主入口模块测试
 *
 * 🌌 测试模块导出
 */

import * as parser from '../parser';
import * as validator from '../validator';
import * as types from '../types';
import * as index from '../index';

describe('模块导出', () => {
    it('应该导出解析器函数', () => {
        expect(parser.parseTemplateExpression).toBeDefined();
        expect(parser.extractTemplateExpressions).toBeDefined();
        expect(parser.extractTemplateExpressionsFromObject).toBeDefined();
        expect(parser.hasTemplateExpression).toBeDefined();
        expect(parser.getAllVariableReferences).toBeDefined();
    });

    it('应该导出验证器函数', () => {
        expect(validator.validateVariableReferences).toBeDefined();
        expect(validator.validateTemplateExpression).toBeDefined();
        expect(validator.validateTemplateExpressionsInObject).toBeDefined();
    });

    it('应该导出类型定义', () => {
        // 类型在运行时不可用，但我们可以检查模块是否正常导出
        expect(types).toBeDefined();
    });

    it('应该从主入口导出所有功能', () => {
        expect(index.parseTemplateExpression).toBeDefined();
        expect(index.extractTemplateExpressions).toBeDefined();
        expect(index.validateTemplateExpression).toBeDefined();
        expect(index.PACKAGE_INFO).toBeDefined();
    });

    it('应该包含包信息', () => {
        expect(index.PACKAGE_INFO.name).toBe('@systembug/zouwu-expression-parser');
        expect(index.PACKAGE_INFO.version).toBe('1.0.0');
    });
});
