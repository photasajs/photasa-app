// Jest测试不需要导入describe, it, expect
import * as fs from "fs-extra";
import * as path from "path";
import { WorkflowLoader } from "../../core/WorkflowLoader";

describe("WorkflowLoader 子目录支持", () => {
    let tempDir: string;
    let workflowLoader: WorkflowLoader;

    beforeEach(async () => {
        // 创建临时目录
        tempDir = await fs.mkdtemp("test-workflows-");

        // 创建测试工作流文件结构
        await fs.ensureDir(path.join(tempDir, "preference"));
        await fs.ensureDir(path.join(tempDir, "scan"));

        // 创建preference/get_preferences.yml
        await fs.writeFile(
            path.join(tempDir, "preference", "get_preferences.yml"),
            `id: "get_preferences"
name: "获取偏好设置"
description: "测试工作流"
version: "1.0.0"
triggers:
  - intent: "get_preferences"
steps:
  - name: "test_step"
    type: "validation"
    action:
      validate: []`,
        );

        // 创建根目录的工作流
        await fs.writeFile(
            path.join(tempDir, "root_workflow.yml"),
            `id: "root_workflow"
name: "根目录工作流"
description: "测试根目录工作流"
version: "1.0.0"
triggers:
  - intent: "root_test"
steps:
  - name: "test_step"
    type: "validation"
    action:
      validate: []`,
        );

        // 创建WorkflowLoader实例
        workflowLoader = new WorkflowLoader(tempDir, {
            enableHotReload: false,
            cacheTimeout: 300000,
        });

        await workflowLoader.initialize();
    });

    afterEach(async () => {
        await workflowLoader.cleanup();
        await fs.remove(tempDir);
    });

    it("应该能从子目录加载工作流", async () => {
        // 测试从preference子目录加载工作流
        const workflow = await workflowLoader.loadWorkflow("get_preferences");

        expect(workflow).toBeDefined();
        expect(workflow?.id).toBe("get_preferences");
        expect(workflow?.name).toBe("获取偏好设置");
    });

    it("应该能从根目录加载工作流", async () => {
        // 测试从根目录加载工作流
        const workflow = await workflowLoader.loadWorkflow("root_workflow");

        expect(workflow).toBeDefined();
        expect(workflow?.id).toBe("root_workflow");
        expect(workflow?.name).toBe("根目录工作流");
    });

    it("应该优先从根目录加载工作流", async () => {
        // 在根目录和子目录都创建同名工作流
        await fs.writeFile(
            path.join(tempDir, "duplicate.yml"),
            `id: "duplicate"
name: "根目录重复工作流"
description: "根目录版本"
version: "1.0.0"
triggers:
  - intent: "duplicate"
steps: []`,
        );

        await fs.writeFile(
            path.join(tempDir, "preference", "duplicate.yml"),
            `id: "duplicate"
name: "子目录重复工作流"
description: "子目录版本"
version: "1.0.0"
triggers:
  - intent: "duplicate"
steps: []`,
        );

        // 重新初始化以加载新文件
        await workflowLoader.cleanup();
        workflowLoader = new WorkflowLoader(tempDir, {
            enableHotReload: false,
            cacheTimeout: 300000,
        });
        await workflowLoader.initialize();

        const workflow = await workflowLoader.loadWorkflow("duplicate");

        expect(workflow).toBeDefined();
        expect(workflow?.description).toBe("根目录版本"); // 应该优先加载根目录版本
    });

    it("应该正确扫描所有子目录的工作流", async () => {
        const allWorkflows = await workflowLoader.getAllWorkflows();

        expect(allWorkflows.length).toBeGreaterThanOrEqual(2);

        const workflowIds = allWorkflows.map((w) => w.id);
        expect(workflowIds).toContain("get_preferences");
        expect(workflowIds).toContain("root_workflow");
    });

    it("应该在工作流不存在时返回null", async () => {
        const workflow = await workflowLoader.loadWorkflow("nonexistent_workflow");
        expect(workflow).toBeNull();
    });
});
