import fs from 'fs';
import path from 'path';

describe('Schema 文件完整性', () => {
    const rootDir = path.join(__dirname, '..');
    const schemasDir = path.join(rootDir, 'schemas');
    const expectedSchemas = [
        'workflow.schema.json',
        'step-types.schema.json',
        'template-syntax.schema.json',
    ];

    expectedSchemas.forEach((schemaFile) => {
        test(`应该存在并验证 ${schemaFile}`, () => {
            const schemaPath = path.join(schemasDir, schemaFile);

            expect(fs.existsSync(schemaPath)).toBe(true);

            const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
            const schema = JSON.parse(schemaContent);

            expect(schema.$schema).toBeDefined();
            expect(schema.$id).toBeDefined();
            expect(schema.title).toBeDefined();
        });
    });
});
