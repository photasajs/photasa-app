# RFC 0060: Zouwu Syntax Highlighting for VS Code

## Summary

This RFC proposes the creation of a VS Code extension to provide syntax highlighting and language support for `.zouwu` workflow files. The goal is to improve the developer experience by differentiating between standard YAML structure and the embedded Zouwu Expression Language.

## Motivation

Zouwu workflows use a YAML-based structure but rely heavily on a custom expression language (Zouwu Expressions) embedded within string values using the `{{ }}` syntax. Standard YAML highlighting is insufficient because:

1.  It treats expression strings as simple text.
2.  It does not validate the specific schema of Zouwu workflows.
3.  Complex expressions (e.g., `{{ steps.scan.output.files.filter(f => f.size > 1024) }}`) are hard to read and debug without proper highlighting.

Providing a dedicated "Zouwu" language mode in VS Code will significantly reduce errors and improve readability.

## Proposal

### 1. New File Extension

Define `.zouwu` as the standard file extension for Zouwu workflow definitions.

- **Language ID**: `zouwu`
- **Base Language**: `yaml`

### 2. VS Code Extension

Create a new package `@systembug/zouwu-vscode` (or similar) that contributes:

- A `grammars` contribution point for syntax highlighting.
- A `languages` contribution point for the `.zouwu` extension.

### 3. Syntax Highlighting Strategy

The syntax highlighting will be implemented using TextMate grammars. Since `.zouwu` is a superset of YAML, we will inject the Zouwu Expression grammar into YAML string contexts.

#### Grammar Structure

- **Scope Name**: `source.zouwu`
- **Injections**:
    - Target: `string.quoted.double.yaml`, `string.unquoted.plain.out.yaml`
    - Match: `\{\{` and `\}\}` delimiters.

#### Expression Tokenization

Inside `{{ ... }}`, the grammar should tokenize:

- **Keywords**: `true`, `false`, `null`, `if`, `else`, etc.
- **Operators**: `+`, `-`, `*`, `/`, `>`, `<`, `==`, `!=`, `&&`, `||`, etc.
- **Functions**: `filter`, `map`, `length`, and standard library functions.
- **Variables**: `steps`, `inputs`, `outputs`, global variables.
- **Properties**: Dot accessors (e.g., `.output.files`).
- **Strings**: Nested quotes.

### 4. Language Configuration

Provide basic language configuration:

- **Comments**: `#`
- **Brackets**: `[]`, `{}`, `()`
- **Auto-closing pairs**: `{{ }}`

## Implementation Details

### TextMate Grammar Example (Conceptual)

```json
{
    "scopeName": "source.zouwu",
    "injectionSelector": "L:source.yaml string",
    "patterns": [
        {
            "begin": "\\{\\{",
            "end": "\\}\\}",
            "name": "meta.embedded.expression.zouwu",
            "patterns": [{ "include": "#expression" }]
        }
    ],
    "repository": {
        "expression": {
            "patterns": [
                {
                    "match": "\\b(steps|inputs|outputs)\\b",
                    "name": "variable.language.zouwu"
                },
                {
                    "match": "\\b(filter|map|length)\\b",
                    "name": "support.function.zouwu"
                }
            ]
        }
    }
}
```

### Build Integration

- The extension should be developed in a new directory: `packages/@systembug/zouwu-vscode`.
- It should optionally leverage the `zouwu-workflow` schema for IntelliSense (future scope).

## Adoption Plan

1.  **Phase 1**: Create the VS Code extension skeleton with basic grammar.
2.  **Phase 2**: Implement the full TextMate grammar for Zouwu Expressions based on the Peggy grammar.
3.  **Phase 3**: Publish to VS Code Marketplace or distribute as a `.vsix` within the team.
4.  **Phase 4**: Update all `.yaml` workflow files to `.zouwu` extension (optional but recommended).

## Future Possibilities

- **LSP Support**: Implement a Language Server Protocol (LSP) server using the `@zouwu-wf/workflow` validator to provide real-time error checking and auto-completion.
- **Schema Validation**: Automatically apply the Zouwu JSON Schema to `.zouwu` files.
