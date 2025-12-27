// import { TemplateVariableReference, ExpressionParseResult } from "./types";

/**
 * 🌌 表达式求值上下文接口
 */
export interface EvaluationContext {
    /**
     * 获取变量值
     */
    getVariable(name: string): any;

    /**
     * 调用函数
     */
    callFunction(name: string, args: any[]): any;

    /**
     * 获取属性值 (用于成员访问)
     */
    getProperty(object: any, property: string | number): any;
}

/**
 * 📜 默认的属性获取器
 */
// const defaultGetProperty = (obj: any, prop: string | number) => {
//     if (obj === undefined || obj === null) return undefined;
//     return obj[prop];
// };

/**
 * 🔧 AST 求值器
 */
export class ExpressionEvaluator {
    private context: EvaluationContext;

    constructor(context: EvaluationContext) {
        this.context = context;
    }

    /**
     * 求值 AST 节点
     */
    evaluate(node: any): any {
        if (!node) return undefined;

        switch (node.type) {
            case "Literal":
                return node.value;

            case "Identifier":
                return this.context.getVariable(node.name);

            case "BinaryExpression":
                return this.evaluateBinary(node);

            case "UnaryExpression":
                return this.evaluateUnary(node);

            case "ConditionalExpression":
                return this.evaluate(node.test)
                    ? this.evaluate(node.consequent)
                    : this.evaluate(node.alternate);

            case "MemberExpression":
                return this.evaluateMember(node);

            case "CallExpression":
                return this.evaluateCall(node);

            default:
                throw new Error(`Unknown node type: ${node.type}`);
        }
    }

    private evaluateBinary(node: any): any {
        const left = this.evaluate(node.left);
        // 对于逻辑运算，我们需要短路求值吗？
        // 实际上 parse 生成的结构已经是树状的。
        // 对于 || 和 &&，Peggy 生成的也是 BinaryExpression。
        // 但如果我们要实现短路，我们需要在这里特殊处理。
        // 然而我们已经在 evaluate(node.left) 中求值了。
        // 如果我们想要短路，我们需要在 switch 中分别处理 LogicalExpression (AST如果区分的话)。
        // 我们的 Grammar 将 && 和 || 当作 BinaryExpression。
        // 这意味着我们传入这里时 left 已经求值了。
        // wait, node.right 还没求值。

        switch (node.operator) {
            case "+":
                return left + this.evaluate(node.right);
            case "-":
                return left - this.evaluate(node.right);
            case "*":
                return left * this.evaluate(node.right);
            case "/":
                return left / this.evaluate(node.right);
            case "%":
                return left % this.evaluate(node.right);
            case ">":
                return left > this.evaluate(node.right);
            case "<":
                return left < this.evaluate(node.right);
            case ">=":
                return left >= this.evaluate(node.right);
            case "<=":
                return left <= this.evaluate(node.right);
            case "==":
                return left == this.evaluate(node.right);
            case "!=":
                return left != this.evaluate(node.right);
            case "===":
                return left === this.evaluate(node.right);
            case "!==":
                return left !== this.evaluate(node.right);
            case "&&":
                return left && this.evaluate(node.right); // JS && operator short-circuits naturally if we execute it here
            case "||":
                return left || this.evaluate(node.right);
            default:
                throw new Error(`Unknown operator: ${node.operator}`);
        }
    }

    private evaluateUnary(node: any): any {
        const arg = this.evaluate(node.argument);
        switch (node.operator) {
            case "!":
                return !arg;
            case "-":
                return -arg;
            case "+":
                return +arg;
            default:
                throw new Error(`Unknown unary operator: ${node.operator}`);
        }
    }

    private evaluateMember(node: any): any {
        const object = this.evaluate(node.object);
        let property;

        if (node.computed) {
            property = this.evaluate(node.property);
        } else {
            property = node.property.name;
        }

        return this.context.getProperty(object, property);
    }

    private evaluateCall(node: any): any {
        // 如果 callee 是 Identifier，直接调用函数
        if (node.callee.type === "Identifier") {
            const args = node.arguments.map((arg: any) => this.evaluate(arg));
            return this.context.callFunction(node.callee.name, args);
        }

        // 如果是 obj.method() 形式?
        // 我们的 MemberExpression 求值返回的是属性值。
        // 这是一个简化实现。如果属性值是函数，我们如何拿到 `this`？
        // 这个 Evaluator 假设 context.callFunction 处理全局函数。
        // 对于对象方法调用，我们需要更复杂的逻辑。
        // 暂时只支持全局/上下文函数调用。
        throw new Error("Only global function calls are supported (e.g., fn(args))");
    }
}

/**
 * 🚀 简易求值函数
 */
export function evaluateAST(ast: any, context: EvaluationContext): any {
    const evaluator = new ExpressionEvaluator(context);
    return evaluator.evaluate(ast);
}
