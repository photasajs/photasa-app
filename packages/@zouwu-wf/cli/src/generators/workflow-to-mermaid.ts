/**
 * 📜 工作流转 Mermaid 流程图生成器
 *
 * 🌌 仙术功能：解析工作流定义，生成可在 Markdown 中渲染的 Mermaid graph TD 源码
 * 🔧 工作流操作：支持 Condition, Parallel, Loop 等复杂结构的图形化映射
 */

export interface MermaidOptions {
    direction?: "TD" | "LR" | "BT" | "RL";
    includeStyle?: boolean;
}

export class WorkflowToMermaid {
    private workflow: any;
    private options: MermaidOptions;
    private lines: string[] = [];

    // Solarized Palette (Standard Hex)
    private static SOLARIZED = {
        base03: "#002b36",
        base02: "#073642",
        base01: "#586e75",
        base00: "#657b83",
        base0: "#839496",
        base1: "#93a1a1",
        base2: "#eee8d5",
        base3: "#fdf6e3",
        yellow: "#b58900",
        orange: "#cb4b16",
        red: "#dc322f",
        magenta: "#d33682",
        violet: "#6c71c4",
        blue: "#268bd2",
        cyan: "#2aa198",
        green: "#859900",
    };

    constructor(workflow: any, options: MermaidOptions = {}) {
        this.workflow = workflow;
        this.options = {
            direction: "TD",
            includeStyle: true,
            ...options,
        };
    }

    /**
     * 🌌 生成 Mermaid 源码
     */
    generate(): string {
        this.lines = [];
        const sol = WorkflowToMermaid.SOLARIZED;

        // 🌌 引入单一自适应初始化，使用 Base01 作为泛任文本色以兼容亮暗模式
        this.lines.push(`%%{init: {
            'theme': 'base',
            'themeVariables': {
                'fontFamily': 'Inter, system-ui, sans-serif',
                'primaryTextColor': '${sol.base01}',
                'mainBkg': 'transparent',
                'nodeBorder': '${sol.base1}',
                'lineColor': '${sol.base0}'
            }
        } }%%`);

        this.lines.push(`graph ${this.options.direction}`);

        if (this.workflow.steps && Array.isArray(this.workflow.steps)) {
            this.processSteps(this.workflow.steps);
        }

        if (this.options.includeStyle) {
            this.addStyles();
        }

        return this.lines.join("\n");
    }

    /**
     * 📜 处理步骤列表
     */
    private processSteps(steps: any[], _parentId?: string): void {
        for (const step of steps) {
            this.processStep(step);

            // 处理显式依赖
            if (step.dependsOn) {
                const dependencies = Array.isArray(step.dependsOn)
                    ? step.dependsOn
                    : [step.dependsOn];
                for (const depId of dependencies) {
                    this.lines.push(`  ${depId} --> ${step.id}`);
                }
            }
        }
    }

    /**
     * 🔧 处理单个步骤
     */
    private processStep(step: any): void {
        const { id, type, name } = step;
        const label = name || id;

        switch (type) {
            case "condition":
                this.lines.push(`  ${id}{"${label}"}`);
                if (step.onTrue && Array.isArray(step.onTrue)) {
                    this.processSteps(step.onTrue, id);
                    if (step.onTrue.length > 0) {
                        this.lines.push(`  ${id} -- "是(True)" --> ${step.onTrue[0].id}`);
                    }
                }
                if (step.onFalse && Array.isArray(step.onFalse)) {
                    this.processSteps(step.onFalse, id);
                    if (step.onFalse.length > 0) {
                        this.lines.push(`  ${id} -- "否(False)" --> ${step.onFalse[0].id}`);
                    }
                }
                break;

            case "parallel":
                this.lines.push(`  ${id}[["并行: ${label}"]]`);
                if (step.branches && Array.isArray(step.branches)) {
                    for (const branch of step.branches) {
                        if (
                            branch.steps &&
                            Array.isArray(branch.steps) &&
                            branch.steps.length > 0
                        ) {
                            this.processSteps(branch.steps, id);
                            this.lines.push(
                                `  ${id} -- "${branch.name || "分支"}" --> ${branch.steps[0].id}`,
                            );
                        }
                    }
                }
                break;

            case "loop":
                this.lines.push(`  ${id}(("循环: ${label}"))`);
                if (step.steps && Array.isArray(step.steps) && step.steps.length > 0) {
                    this.processSteps(step.steps, id);
                    this.lines.push(`  ${id} --> ${step.steps[0].id}`);
                    const lastStep = step.steps[step.steps.length - 1];
                    this.lines.push(`  ${lastStep.id} -. "回归" .-> ${id}`);
                }
                break;

            case "action":
            case "builtin":
            default:
                this.lines.push(`  ${id}["${label}"]`);
                break;
        }
    }

    /**
     * 🎨 添加节点样式：使用半透明描边方案以自适应主题背景
     */
    private addStyles(): void {
        const sol = WorkflowToMermaid.SOLARIZED;
        this.lines.push("");
        this.lines.push(`  %% 🎨 单一自适应 Solarized 配色`);
        this.lines.push(
            `  classDef condition fill:${sol.yellow}22,stroke:${sol.yellow},stroke-width:2px,color:${sol.base01};`,
        );
        this.lines.push(
            `  classDef parallel fill:${sol.blue}22,stroke:${sol.blue},stroke-width:2px,color:${sol.blue};`,
        );
        this.lines.push(
            `  classDef loop fill:${sol.violet}22,stroke:${sol.violet},stroke-width:2px,color:${sol.violet};`,
        );
        this.lines.push(
            `  classDef action fill:${sol.green}22,stroke:${sol.green},stroke-width:2px,color:${sol.green};`,
        );

        if (this.workflow.steps) {
            this.applyStylesRecursive(this.workflow.steps);
        }
    }

    private applyStylesRecursive(steps: any[]): void {
        for (const step of steps) {
            if (step.type === "condition") {
                this.lines.push(`  class ${step.id} condition`);
                if (step.onTrue) this.applyStylesRecursive(step.onTrue);
                if (step.onFalse) this.applyStylesRecursive(step.onFalse);
            } else if (step.type === "parallel") {
                this.lines.push(`  class ${step.id} parallel`);
                if (step.branches) {
                    step.branches.forEach((b: any) => this.applyStylesRecursive(b.steps || []));
                }
            } else if (step.type === "loop") {
                this.lines.push(`  class ${step.id} loop`);
                if (step.steps) this.applyStylesRecursive(step.steps);
            } else {
                this.lines.push(`  class ${step.id} action`);
            }
        }
    }
}

export function generateWorkflowMermaidMarkdown(
    workflow: any,
    options: MermaidOptions = {},
): string {
    const generator = new WorkflowToMermaid(workflow, options);
    const mermaid = generator.generate();
    return "```mermaid\n" + mermaid + "\n```";
}
