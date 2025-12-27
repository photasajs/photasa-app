import { parseExpressionToAST } from "../parser";
import { extractTemplateExpressions } from "../parser";

describe("Expression Parser (Exhaustive)", () => {
    describe("Literals", () => {
        test("should parse strings", () => {
            expect(parseExpressionToAST('"hello"').value).toBe("hello");
            expect(parseExpressionToAST("'world'").value).toBe("world");
            expect(parseExpressionToAST('"escaped \\"quote\\""').value).toBe('escaped "quote"');
        });

        test("should parse numbers", () => {
            expect(parseExpressionToAST("123").value).toBe(123);
            expect(parseExpressionToAST("123.456").value).toBe(123.456);
            expect(parseExpressionToAST("0").value).toBe(0);
        });

        test("should parse booleans", () => {
            expect(parseExpressionToAST("true").value).toBe(true);
            expect(parseExpressionToAST("false").value).toBe(false);
        });

        test("should parse null", () => {
            expect(parseExpressionToAST("null").value).toBe(null);
        });
    });

    describe("Unary Operations", () => {
        test("should parse negation (!)", () => {
            const ast = parseExpressionToAST("!true");
            expect(ast.type).toBe("UnaryExpression");
            expect(ast.operator).toBe("!");
            expect(ast.argument.value).toBe(true);
        });

        test("should parse negative numbers (-)", () => {
            const ast = parseExpressionToAST("-10");
            expect(ast.type).toBe("UnaryExpression");
            expect(ast.operator).toBe("-");
            expect(ast.argument.value).toBe(10);
        });

        test("should parse unary plus (+)", () => {
            const ast = parseExpressionToAST("+10");
            expect(ast.type).toBe("UnaryExpression");
            expect(ast.operator).toBe("+");
        });
    });

    describe("Arithmetic Operations", () => {
        test("should parse simple arithmetic", () => {
            const ast = parseExpressionToAST("1 + 2");
            expect(ast.type).toBe("BinaryExpression");
            expect(ast.operator).toBe("+");
        });

        test("should respect precedence (* over +)", () => {
            const ast = parseExpressionToAST("1 + 2 * 3");
            expect(ast.operator).toBe("+");
            expect(ast.right.operator).toBe("*");
        });

        test("should parse complex arithmetic expressions", () => {
            // (1 + 2) * (3 - 4) / 5
            const ast = parseExpressionToAST("(1 + 2) * (3 - 4) / 5");
            expect(ast.operator).toBe("/");
            expect(ast.left.operator).toBe("*");
        });
    });

    describe("Comparison Operations", () => {
        test("should parse comparison operators", () => {
            expect(parseExpressionToAST("a > b").operator).toBe(">");
            expect(parseExpressionToAST("a < b").operator).toBe("<");
            expect(parseExpressionToAST("a >= b").operator).toBe(">=");
            expect(parseExpressionToAST("a <= b").operator).toBe("<=");
            expect(parseExpressionToAST("a == b").operator).toBe("==");
            expect(parseExpressionToAST("a != b").operator).toBe("!=");
            expect(parseExpressionToAST("a === b").operator).toBe("===");
            expect(parseExpressionToAST("a !== b").operator).toBe("!==");
        });
    });

    describe("Logical Operations", () => {
        test("should parse logical AND and OR", () => {
            const ast = parseExpressionToAST("a && b || c");
            // && binds tighter than ||
            // (a && b) || c
            expect(ast.operator).toBe("||");
            expect(ast.left.operator).toBe("&&");
        });
    });

    describe("Ternary Operations", () => {
        test("should parse ternary expression", () => {
            const ast = parseExpressionToAST("a ? b : c");
            expect(ast.type).toBe("ConditionalExpression");
            expect(ast.test.name).toBe("a");
            expect(ast.consequent.name).toBe("b");
            expect(ast.alternate.name).toBe("c");
        });

        test("should parse nested ternary (right associative)", () => {
            // a ? b : c ? d : e  -> a ? b : (c ? d : e)
            const ast = parseExpressionToAST("a ? b : c ? d : e");
            expect(ast.type).toBe("ConditionalExpression");
            expect(ast.test.name).toBe("a");
            expect(ast.alternate.type).toBe("ConditionalExpression");
            expect(ast.alternate.test.name).toBe("c");
        });
    });

    describe("Member Expressions", () => {
        test("should parse dot notation", () => {
            const ast = parseExpressionToAST("obj.prop");
            expect(ast.type).toBe("MemberExpression");
            expect(ast.computed).toBe(false);
            expect(ast.property.name).toBe("prop");
        });

        test("should parse bracket notation with quotes", () => {
            const ast = parseExpressionToAST('obj["prop"]');
            expect(ast.type).toBe("MemberExpression");
            expect(ast.computed).toBe(true);
            expect(ast.property.value).toBe("prop");
        });

        test("should parse array index", () => {
            const ast = parseExpressionToAST("arr[0]");
            expect(ast.type).toBe("MemberExpression");
            expect(ast.computed).toBe(true);
            expect(ast.property.value).toBe(0);
        });

        test("should parse deep nesting", () => {
            // obj.a[0].b
            const ast = parseExpressionToAST("obj.a[0].b");
            // ((obj.a)[0]).b
            expect(ast.property.name).toBe("b");
            expect(ast.object.type).toBe("MemberExpression");
            expect(ast.object.computed).toBe(true); // [0]
            expect(ast.object.object.property.name).toBe("a");
        });
    });

    describe("Function Calls", () => {
        test("should parse no-arg call", () => {
            const ast = parseExpressionToAST("fn()");
            expect(ast.type).toBe("CallExpression");
            expect(ast.arguments.length).toBe(0);
        });

        test("should parse multi-arg call", () => {
            const ast = parseExpressionToAST("fn(1, 2, 3)");
            expect(ast.arguments.length).toBe(3);
        });

        test("should parse nested calls", () => {
            const ast = parseExpressionToAST("fn(g(x))");
            expect(ast.arguments[0].type).toBe("CallExpression");
            expect(ast.arguments[0].callee.name).toBe("g");
        });
    });

    describe("Integration", () => {
        test("should extract and parse", () => {
            const exprs = extractTemplateExpressions("Total: {{ price * quantity }}");
            expect(exprs.hasTemplate).toBe(true);
            expect(exprs.expressions).toHaveLength(1);

            const ast = parseExpressionToAST(exprs.expressions[0]);
            expect(ast.operator).toBe("*");
        });
    });

    describe("Error Handling", () => {
        test("should throw on incomplete expression", () => {
            expect(() => parseExpressionToAST("1 +")).toThrow();
        });

        test("should throw on unbalanced parentheses", () => {
            expect(() => parseExpressionToAST("(1 + 2")).toThrow();
            expect(() => parseExpressionToAST("1 + 2)")).toThrow();
        });

        test("should throw on invalid character", () => {
            expect(() => parseExpressionToAST("@")).toThrow();
        });

        test("should throw on missing operand", () => {
            expect(() => parseExpressionToAST("* 2")).toThrow();
        });

        test("should throw on invalid property access", () => {
            expect(() => parseExpressionToAST("obj.")).toThrow();
        });

        test("should throw on empty property access", () => {
            expect(() => parseExpressionToAST("obj[]")).toThrow();
        });
    });

    describe("Whitespace Handling", () => {
        test("should ignore whitespace", () => {
            const ast = parseExpressionToAST("  1   +   2  ");
            expect(ast.operator).toBe("+");
        });

        test("should handle whitespace in property access", () => {
            const ast = parseExpressionToAST(" a  .  b ");
            expect(ast.type).toBe("MemberExpression");
            expect(ast.property.name).toBe("b");
        });

        test("should handle whitespace in function call", () => {
            const ast = parseExpressionToAST(" fn ( 1 , 2 ) ");
            expect(ast.arguments.length).toBe(2);
        });
    });
});
