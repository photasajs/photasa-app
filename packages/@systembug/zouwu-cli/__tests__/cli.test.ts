import fs from 'fs';
import path from 'path';

describe('CLI 命令', () => {
    test('CLI 源文件应该存在', () => {
        const rootDir = path.join(__dirname, '..');
        const cliSourcePath = path.join(rootDir, 'src', 'cli', 'index.ts');

        expect(fs.existsSync(cliSourcePath)).toBe(true);
    });
});
