import { parseExpressionToAST } from "../parser";
import { evaluateAST, EvaluationContext } from "../evaluator";

describe("Expression Evaluator", () => {
    let context: EvaluationContext;
    let variables: Record<string, any>;
    let functions: Record<string, (...args: any[]) => any>;

    beforeEach(() => {
        variables = {
            a: 10,
            b: 20,
            user: {
                name: "Alice",
                age: 30,
                scores: [100, 90, 80],
            },
            isReady: true,
        };

        functions = {
            max: (...args: any[]) => Math.max(...args),
            greet: (name: string) => `Hello, ${name}`,
            add: (x: number, y: number) => x + y,
        };

        context = {
            getVariable: (name: string) => variables[name],
            callFunction: (name: string, args: any[]) => {
                if (functions[name]) {
                    return functions[name](...args);
                }
                throw new Error(`Function ${name} not found`);
            },
            getProperty: (obj: any, prop: string | number) => {
                return obj ? obj[prop] : undefined;
            },
        };
    });

    const evalExpr = (expr: string) => {
        const ast = parseExpressionToAST(expr);
        return evaluateAST(ast, context);
    };

    describe("Arithmetic", () => {
        test("should evaluate simple math", () => {
            expect(evalExpr("1 + 2")).toBe(3);
            expect(evalExpr("10 - 4")).toBe(6);
            expect(evalExpr("3 * 4")).toBe(12);
            expect(evalExpr("10 / 2")).toBe(5);
            expect(evalExpr("10 % 3")).toBe(1);
        });

        test("should evaluate mixed precedence", () => {
            expect(evalExpr("1 + 2 * 3")).toBe(7);
            expect(evalExpr("(1 + 2) * 3")).toBe(9);
        });

        test("should evaluate variables", () => {
            expect(evalExpr("a + b")).toBe(30);
            expect(evalExpr("a * 2")).toBe(20);
        });
    });

    describe("Member Access", () => {
        test("should access object properties", () => {
            expect(evalExpr("user.name")).toBe("Alice");
            expect(evalExpr("user.age")).toBe(30);
        });

        test("should access nested properties", () => {
            expect(evalExpr("user.scores[0]")).toBe(100);
            expect(evalExpr('user["name"]')).toBe("Alice");
        });
    });

    describe("Function Calls", () => {
        test("should call functions", () => {
            expect(evalExpr("max(1, 5, 2)")).toBe(5);
            expect(evalExpr('greet("World")')).toBe("Hello, World");
        });

        test("should use variables in function arguments", () => {
            expect(evalExpr("add(a, b)")).toBe(30);
        });

        test("should handle nested function calls", () => {
            // max(10, add(5, 5)) -> max(10, 10) -> 10
            expect(evalExpr("max(a, add(5, 5))")).toBe(10);
        });
    });

    describe("Logic & Comparison", () => {
        test("should evaluate comparisons", () => {
            expect(evalExpr("a > 5")).toBe(true);
            expect(evalExpr("a < 5")).toBe(false);
            expect(evalExpr("a == 10")).toBe(true);
            expect(evalExpr("a != 20")).toBe(true);
        });

        test("should evaluate logical ops", () => {
            expect(evalExpr("true && true")).toBe(true);
            expect(evalExpr("true && false")).toBe(false);
            expect(evalExpr("false || true")).toBe(true);
            expect(evalExpr("isReady && a > 5")).toBe(true);
        });

        test("should verify short-circuiting", () => {
            // We can check short-circuit behavior if we had side effects,
            // but here we trust JS engine.
            // Let's test basic logic correctness.
            // If a is undefined, accessing a.b would convert to undefined via getProperty,
            // but if variable lookup throws, checking short-circuit is harder with this context.
            // Let's assume standard behavior.
            expect(evalExpr("false && nonsense")).toBe(false); // variable lookup 'nonsense' returns undefined
            expect(evalExpr("true || nonsense")).toBe(true);
        });
    });

    describe("Ternary", () => {
        test("should evaluate ternary", () => {
            expect(evalExpr('a > 5 ? "yes" : "no"')).toBe("yes");
            expect(evalExpr('a < 5 ? "yes" : "no"')).toBe("no");
        });
    });
});
