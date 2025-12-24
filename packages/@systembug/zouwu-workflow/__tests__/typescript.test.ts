import { execSync } from 'child_process';
import path from 'path';

describe('TypeScript 编译', () => {
    test('应该通过 TypeScript 编译检查', () => {
        const rootDir = path.join(__dirname, '..');

        expect(() => {
            execSync('npx tsc --noEmit', {
                cwd: rootDir,
                stdio: 'pipe',
            });
        }).not.toThrow();
    });
});
