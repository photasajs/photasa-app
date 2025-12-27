import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { generateTypesFromSchema } from '../src/generators/schema-to-types';

describe('代码生成器', () => {
    const rootDir = path.join(__dirname, '..');
    const testDir = path.join(rootDir, 'test-output');
    const workflowPackageDir = path.join(rootDir, '../zouwu-workflow');

    beforeAll(() => {
        // 清理测试目录
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        fs.mkdirSync(testDir, { recursive: true });

        // 编译 TypeScript
        const tsBuildDir = path.join(testDir, 'build');
        fs.mkdirSync(tsBuildDir, { recursive: true });

        execSync(`npx tsc --outDir ${tsBuildDir}`, {
            cwd: rootDir,
            stdio: 'pipe',
        });

        // 从工作流包复制 schemas
        const schemasSource = path.join(workflowPackageDir, 'schemas');
        const schemasDest = path.join(tsBuildDir, 'schemas');

        if (fs.existsSync(schemasSource)) {
            fs.mkdirSync(schemasDest, { recursive: true });
            const schemaFiles = fs.readdirSync(schemasSource);
            for (const file of schemaFiles) {
                if (file.endsWith('.json')) {
                    fs.copyFileSync(path.join(schemasSource, file), path.join(schemasDest, file));
                }
            }
        }
    });

    afterAll(() => {
        // 清理测试目录
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    test('应该生成类型文件', async () => {
        const tsBuildDir = path.join(testDir, 'build');
        const workflowSchemaPath = path.join(tsBuildDir, 'schemas', 'workflow.schema.json');
        const typesOutputPath = path.join(testDir, 'workflow.types.ts');

        expect(fs.existsSync(workflowSchemaPath)).toBe(true);

        await generateTypesFromSchema({
            schemaPath: workflowSchemaPath,
            outputPath: typesOutputPath,
            generateDocs: true,
        });

        expect(fs.existsSync(typesOutputPath)).toBe(true);

        const content = fs.readFileSync(typesOutputPath, 'utf-8');
        expect(content).toContain('export');
    });
});
