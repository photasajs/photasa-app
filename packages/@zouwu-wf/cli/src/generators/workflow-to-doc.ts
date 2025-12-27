/**
 * 📜 工作流 API 文档生成器
 *
 * 🌌 仙术功能：从工作流定义中提取元数据、输入参数和输出规范，生成 API 风格的 Markdown 文档
 * 🔧 工作流操作：支持 RFC 0039 的输入输出规格解析
 */

export class WorkflowToDoc {
    private workflow: any;

    constructor(workflow: any) {
        this.workflow = workflow;
    }

    /**
     * 🌌 生成完整 Markdown 文档
     */
    generate(): string {
        const sections: string[] = [];

        // 1. 标题与描述
        sections.push(`# 📜 工作流: ${this.workflow.name || this.workflow.id}`);
        if (this.workflow.description) {
            sections.push(`> ${this.workflow.description}`);
        }
        sections.push("");

        // 2. 元数据
        sections.push("## 📑 基本信息");
        sections.push(`- **标识 (ID)**: \`${this.workflow.id}\``);
        if (this.workflow.version)
            sections.push(`- **版本 (Version)**: \`${this.workflow.version}\``);
        if (this.workflow.author) sections.push(`- **作者 (Author)**: ${this.workflow.author}`);
        sections.push("");

        // 3. 输入参数 (API Inputs)
        sections.push("## 📥 输入参数 (Inputs)");
        if (this.workflow.inputs) {
            sections.push("| 参数名 | 类型 | 必填 | 描述 |");
            sections.push("| :--- | :--- | :--- | :--- |");

            if (Array.isArray(this.workflow.inputs)) {
                // 数组格式
                for (const input of this.workflow.inputs) {
                    sections.push(
                        `| \`${input.name}\` | \`${input.type || "any"}\` | ${input.required ? "✅" : "❌"} | ${input.description || "-"} |`,
                    );
                }
            } else {
                // 对象/字典格式
                for (const [name, config] of Object.entries(this.workflow.inputs)) {
                    const cfg = config as any;
                    sections.push(
                        `| \`${name}\` | \`${cfg.type || "any"}\` | ${cfg.required ? "✅" : "❌"} | ${cfg.description || "-"} |`,
                    );
                }
            }
        } else {
            sections.push("*无定义输入参数*");
        }
        sections.push("");

        // 4. 工作流变量
        if (this.workflow.variables && Object.keys(this.workflow.variables).length > 0) {
            sections.push("## 🔧 内部变量 (Variables)");
            sections.push("| 变量名 | 初始值 |");
            sections.push("| :--- | :--- |");
            for (const [key, value] of Object.entries(this.workflow.variables)) {
                sections.push(`| \`${key}\` | \`${JSON.stringify(value)}\` |`);
            }
            sections.push("");
        }

        // 5. 预期输出 (Outputs)
        sections.push("## 📤 输出规范 (Outputs)");
        const returnStep = this.findReturnStep(this.workflow.steps || []);
        if (returnStep && returnStep.input) {
            sections.push("工作流执行完成后返回如下结构：");
            sections.push("```json");
            sections.push(JSON.stringify(returnStep.input, null, 2));
            sections.push("```");
        } else if (this.workflow.outputs) {
            sections.push("定义输出：");
            sections.push("```json");
            sections.push(JSON.stringify(this.workflow.outputs, null, 2));
            sections.push("```");
        } else {
            sections.push("*该工作流无显式返回定义*");
        }
        sections.push("");

        return sections.join("\n");
    }

    /**
     * 📜 寻找最后一个返回步骤
     */
    private findReturnStep(steps: any[]): any {
        // 逆向寻找最后一个 type: builtin, action: return 的步骤
        for (let i = steps.length - 1; i >= 0; i--) {
            const step = steps[i];
            if (step.type === "builtin" && step.action === "return") {
                return step;
            }
            // 如果没有在顶层找到，递归查找逻辑分支（虽然通常返回都在顶层）
        }
        return null;
    }
}
