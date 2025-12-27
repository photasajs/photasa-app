// Zouwu Expression Grammar
// 用于解析工作流中的表达式

{{
  function makeBinaryOp(head, tail) {
    return tail.reduce((result, element) => {
      return {
        type: "BinaryExpression",
        operator: element[1],
        left: result,
        right: element[3]
      };
    }, head);
  }
}}

Start
  = _ expr:Expression _ { return expr; }

Expression
  = TernaryExpression

TernaryExpression
  = head:LogicalORExpression tail:(_ "?" _ Expression _ ":" _ Expression)? {
      if (tail) {
        return {
          type: "ConditionalExpression",
          test: head,
          consequent: tail[3],
          alternate: tail[7]
        };
      }
      return head;
    }

LogicalORExpression
  = head:LogicalANDExpression tail:(_ "||" _ LogicalANDExpression)* {
      return makeBinaryOp(head, tail);
    }

LogicalANDExpression
  = head:EqualityExpression tail:(_ "&&" _ EqualityExpression)* {
      return makeBinaryOp(head, tail);
    }

EqualityExpression
  = head:RelationalExpression tail:(_ ("===" / "!==" / "==" / "!=") _ RelationalExpression)* {
      return makeBinaryOp(head, tail);
    }

RelationalExpression
  = head:AdditiveExpression tail:(_ ("<=" / ">=" / "<" / ">") _ AdditiveExpression)* {
      return makeBinaryOp(head, tail);
    }

AdditiveExpression
  = head:MultiplicativeExpression tail:(_ ("+" / "-") _ MultiplicativeExpression)* {
      return makeBinaryOp(head, tail);
    }

MultiplicativeExpression
  = head:UnaryExpression tail:(_ ("*" / "/" / "%") _ UnaryExpression)* {
      return makeBinaryOp(head, tail);
    }

UnaryExpression
  = operator:("!" / "-" / "+") _ argument:UnaryExpression {
      return {
        type: "UnaryExpression",
        operator: operator,
        argument: argument,
        prefix: true
      };
    }
  / MemberExpression

MemberExpression
  = head:PrimaryExpression tail:(
      _ "[" _ PropertyExpression _ "]"
    / _ "." _ IdentifierName
    / _ args:Arguments
  )* {
    return tail.reduce((result, element) => {
      if (element[1] === "[") {
        return {
          type: "MemberExpression",
          object: result,
          property: element[3],
          computed: true
        };
      } else if (element[1] === ".") {
        return {
          type: "MemberExpression",
          object: result,
          property: { type: "Identifier", name: element[3] },
          computed: false
        };
      } else {
        // Arguments - element is [whitespace, args]
        return {
            type: "CallExpression",
            callee: result,
            arguments: element[1]
        };
      }
    }, head);
  }

PrimaryExpression
  = Literal
  / Identifier
  / "(" _ expression:Expression _ ")" { return expression; }

Arguments
  = "(" _ head:Expression? _ tail:(_ "," _ Expression)* _ ")" {
    if (!head) return [];
    return [head].concat(tail.map(e => e[3]));
  }

PropertyExpression
  = Expression

Literal
  = StringLiteral
  / NumericLiteral
  / BooleanLiteral
  / NullLiteral

Identifier
  = !ReservedWord name:IdentifierName {
      return { type: "Identifier", name: name };
    }

IdentifierName
  = head:[a-zA-Z_$] tail:[a-zA-Z0-9_$]* {
      return head + tail.join("");
    }

ReservedWord
  = ("true" / "false" / "null") !([a-zA-Z0-9_$])

StringLiteral
  = '"' chars:DoubleStringCharacter* '"' { return { type: "Literal", value: chars.join("") }; }
  / "'" chars:SingleStringCharacter* "'" { return { type: "Literal", value: chars.join("") }; }

DoubleStringCharacter
  = !('"' / "\\") . { return text(); }
  / "\\" sequence:EscapeSequence { return sequence; }

SingleStringCharacter
  = !("'" / "\\") . { return text(); }
  / "\\" sequence:EscapeSequence { return sequence; }

EscapeSequence
  = "'"
  / '"'
  / "\\"
  / "b"  { return "\b"; }
  / "f"  { return "\f"; }
  / "n"  { return "\n"; }
  / "r"  { return "\r"; }
  / "t"  { return "\t"; }
  / "v"  { return "\v"; }

NumericLiteral
  = float:DecimalFloat { return { type: "Literal", value: float }; }
  / integer:Integer { return { type: "Literal", value: integer }; }

DecimalFloat
  = integer:Integer "." fraction:[0-9]+ {
      return parseFloat(integer + "." + fraction.join(""));
    }

Integer
  = [0-9]+ { return parseInt(text(), 10); }

BooleanLiteral
  = "true" { return { type: "Literal", value: true }; }
  / "false" { return { type: "Literal", value: false }; }

NullLiteral
  = "null" { return { type: "Literal", value: null }; }

_ "whitespace"
  = [ \t\n\r]*
