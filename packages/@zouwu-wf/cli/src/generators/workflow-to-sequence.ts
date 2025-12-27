/**
 * 📜 工作流时序图生成器
 *
 * 🌌 仙术功能：将工作流步骤映射为 Mermaid 时序图 (Sequence Diagram)
 * 🔧 工作流操作：解析服务调用 (Actions) 和逻辑分支 (Conditions) 的动态交互
 */

export class WorkflowToSequence {
    private workflow: any;
    private options: { theme?: "light" | "dark" }; // 保留接口但不强制区分，实现自适应
    private lines: string[] = [];
    private participants: Set<string> = new Set(["Orchestrator"]);

    // Solarized Palette
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
        blue: "#268bd2",
        green: "#859900",
    };

    constructor(workflow: any, options: { theme?: "light" | "dark" } = {}) {
        this.workflow = workflow;
        this.options = { ...options };
    }

    /**
     * 🌌 生成 Mermaid 时序图源码
     */
    generate(): string {
        this.lines = [];
        this.participants = new Set(["Orchestrator"]);
        this.scanParticipants(this.workflow.steps || []);

        const sol = WorkflowToSequence.SOLARIZED;

        // 🌌 统一自适应配置：背景设为透明，文本使用中性灰 Base01
        this.lines.push(
            `%%{init: {
              'theme': 'base',
              'themeVariables': {
                'fontFamily': 'Inter, system-ui, sans-serif',
                'primaryTextColor': '${sol.base01}',
                'mainBkg': 'transparent',
                'actorBkg': 'transparent',
                'actorBorder': '${sol.base1}',
                'actorTextColor': '${sol.base01}',
                'signalColor': '${sol.base0}',
                'signalTextColor': '${sol.base01}',
                'labelBoxBkgColor': 'transparent',
                'labelBoxBorderColor': '${sol.base1}',
                'labelTextColor': '${sol.base01}',
                'loopTextColor': '${sol.base01}',
                'noteBkgColor': '${sol.base2}88',
                'noteTextColor': '${sol.base01}'
              }
            } }%%`,
        );
        this.lines.push("sequenceDiagram");
        this.lines.push("  autonumber");

        for (const p of this.participants) {
            this.lines.push(`  participant ${p}`);
        }
        this.lines.push("");

        this.processSteps(this.workflow.steps || []);

        return this.lines.join("\n");
    }

    private scanParticipants(steps: any[]): void {
        for (const step of steps) {
            if (step.service) this.participants.add(step.service);
            if (step.type === "condition" || step.type === "loop") {
                this.scanParticipants(step.onTrue || []);
                this.scanParticipants(step.onFalse || []);
                this.scanParticipants(step.steps || []);
            }
            if (step.type === "parallel" && step.branches) {
                for (const branch of step.branches) this.scanParticipants(branch.steps || []);
            }
        }
    }

    private processSteps(steps: any[]): void {
        for (const step of steps) this.processStep(step);
    }

    private processStep(step: any): void {
        const { id, type, name, service, action } = step;
        const label = name || id;

        switch (type) {
            case "condition":
                this.lines.push(`  Note over Orchestrator: 决策: ${label}`);
                if (step.onTrue && step.onTrue.length > 0) {
                    this.lines.push("  alt 满足条件");
                    this.processSteps(step.onTrue);
                    if (step.onFalse && step.onFalse.length > 0) {
                        this.lines.push("  else 不满足条件");
                        this.processSteps(step.onFalse);
                    }
                    this.lines.push("  end");
                }
                break;
            case "parallel":
                this.lines.push(`  rect rgba(38, 139, 210, 0.1)`);
                this.lines.push(`  Note over Orchestrator: 并行执行: ${label}`);
                if (step.branches) {
                    for (const branch of step.branches) this.processSteps(branch.steps || []);
                }
                this.lines.push(`  end`);
                break;
            case "loop":
                this.lines.push(`  loop 循环: ${label}`);
                this.processSteps(step.steps || []);
                this.lines.push("  end");
                break;
            case "action": {
                const target = service || "UnknownService";
                this.lines.push(`  Orchestrator->>+${target}: ${action || "execute"}`);
                if (step.description)
                    this.lines.push(`  Note right of ${target}: ${step.description}`);
                this.lines.push(`  ${target}-->>-Orchestrator: 返回结果`);
                break;
            }
            case "builtin":
                this.lines.push(`  Orchestrator->>Orchestrator: 内置操作 [${action}]`);
                if (action === "return")
                    this.lines.push("  Note over Orchestrator: 📤 结束工作流并返回结果");
                break;
            default:
                this.lines.push(`  Note over Orchestrator: 执行 ${label}`);
                break;
        }
    }
}

export function generateWorkflowSequenceMarkdown(
    workflow: any,
    options: { theme?: "light" | "dark" } = {},
): string {
    const generator = new WorkflowToSequence(workflow, options);
    const sequence = generator.generate();
    return "```mermaid\n" + sequence + "\n```";
}
