# Development Guide

## Table of Contents

- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Debugging](#debugging)
- [Build and Deployment](#build-and-deployment)

## Project Structure

**Photasa** is a **Tauri 2 + Vue 3 + Rust** desktop app (`apps/photasa`). The removed desktop tree was removed in 2026-07 (RFC 0153).

```
picasa-vue/
├── apps/
│ └── photasa/ # Tauri 应用 (@photasa/photasa)
│ ├── src/ # Vue 3 前端（贞观服务层）
│ └── src-tauri/ # Rust 命令与 Tauri 插件
├── crates/ # photasa-scan, photasa-thumbnail, …
├── packages/ # 共享 TS 包（@photasa/common 等）
├── docs/ # 文档
└── .spec/rfc/ # Photasa RFC（canonical）
```

### 包与 crate

- **`apps/photasa`** — 唯一桌面交付；IPC 经 `YuanTianGang.executeZhaoling` → `invoke()`
- **`crates/photasa-*`** — 扫描、缩略图、配置、文件夹树等 Rust 实现
- **`packages/common`** — 共享类型与工具；从 `@photasa/common` 导入

## Development Setup

### Prerequisites

- Node.js 20+、pnpm
- Rust stable、平台 C 工具链（见 RFC 0103 原生依赖）
- Git

### Installation

```bash
pnpm install
```

### Running Development

```bash
pnpm dev # Tauri 开发
pnpm run vite:dev:photasa # 仅 Vite，无原生窗口
```

### Running Tests

```bash
pnpm --filter @photasa/photasa run test:unit
cargo test --workspace
pnpm run clippy
```

## Coding Standards

### TypeScript Guidelines

1. **Use ES6 imports always** - Never use `require()` or dynamic imports unless absolutely necessary
2. **Proper typing** - Avoid using `any` type. Use proper TypeScript types
3. **Type-first approach** - Define interfaces and types before implementation

### Vue Component Guidelines

1. **Component organization**:

- Use component library philosophy for UI design
- Split complex components into sub-components with clear responsibilities
- Base components should start with `Base` prefix
- Domain-specific components should use `Primitive` prefix

2. **Component structure**:

- Prefer TSX for component design
- Organize components in independent directories
- Use multiple support files when necessary

### General Rules

1. **Each change should have corresponding tests**
2. **Never use `console.log`** - Use the logger instead
3. **No `!important` in CSS** - Causes maintenance issues
4. **Document using RFCs** - Index and tables: root `ROADMAP.md` + `TASK_TRACKING.md`; RFC files under `docs/rfc/` and `docs/rfc/completed/`

## Testing Guidelines

### Critical: Avoiding Test Hanging Issues

Test hanging is a critical problem that can block CI/CD pipelines. Follow these guidelines to prevent it:

#### 1. Timer Management in Tests

**ALWAYS clean up timers properly:**

```typescript
// ✅ CORRECT - Proper timer management
describe("Component with timers", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it("should handle timers correctly", async () => {
        // Your test code
        await vi.runAllTimersAsync();
    });
});

// ❌ WRONG - Global timer manipulation without cleanup
vi.useFakeTimers(); // Never do this globally without cleanup!
```

#### 2. Promise Handling

**NEVER create never-resolving Promises:**

```typescript
// ❌ WRONG - This will hang forever
const neverResolves = new Promise(() => {});
const neverResolves2 = new Promise((_resolve) => {
    /* never resolves */
});

// ✅ CORRECT - Use timeout-based Promises with fake timers
const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => resolve(undefined), 5000);
});
// Then in test:
await vi.runAllTimersAsync();

// ✅ CORRECT - For testing timeout behavior
it("should timeout after 5 seconds", async () => {
    vi.useFakeTimers();

    const promise = functionThatMightTimeout();

    // Advance time to test timeout
    vi.advanceTimersByTime(5000);

    await expect(promise).rejects.toThrow("Timeout");

    vi.useRealTimers();
});
```

#### 3. Mock External Dependencies

**ALWAYS mock file system and network operations:**

```typescript
// ✅ CORRECT - Mock file system operations
vi.mock("fs-extra", () => ({
    readFile: vi.fn().mockResolvedValue("mock content"),
    writeFile: vi.fn().mockResolvedValue(undefined),
    existsSync: vi.fn().mockReturnValue(true),
}));

// ✅ CORRECT - Mock file scanning libraries
vi.mock("klaw", () => ({
    default: vi.fn(() => {
        const mockStream = {
            on: vi.fn((event, callback) => {
                if (event === "data") {
                    setTimeout(() => {
                        callback({ path: "/mock/file.jpg", stats: { isDirectory: () => false } });
                    }, 10);
                } else if (event === "end") {
                    setTimeout(() => callback(), 20);
                }
                return mockStream;
            }),
        };
        return mockStream;
    }),
}));

// ❌ WRONG - Real file system operations in tests
import klaw from "klaw";
const stream = klaw("/actual/directory"); // This will scan real filesystem!
```

#### 4. Observable Handling

**Ensure Observables complete properly:**

```typescript
// ✅ CORRECT - Observable that completes
import { Observable } from "rxjs";

const mockObservable = new Observable((subscriber) => {
    subscriber.next("data");
    subscriber.complete(); // Important!
});

// ❌ WRONG - Observable that never completes
const neverCompletes = new Observable((subscriber) => {
    subscriber.next("data");
    // Missing subscriber.complete()
});
```

#### 5. Async Test Patterns

**Use proper async/await patterns:**

```typescript
// ✅ CORRECT - Proper async test
it("should handle async operations", async () => {
    const result = await asyncFunction();
    expect(result).toBe("expected");
});

// ✅ CORRECT - Testing with fake timers
it("should handle delayed operations", async () => {
    vi.useFakeTimers();

    const promise = delayedOperation();

    // Advance all timers
    await vi.runAllTimersAsync();

    const result = await promise;
    expect(result).toBe("expected");

    vi.useRealTimers();
});

// ❌ WRONG - Mixing real and fake timers
it("should not mix timer types", async () => {
    vi.useFakeTimers();
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Real timeout with fake timers!
});
```

#### 6. Test Timeouts Configuration

**Configure reasonable timeouts in vitest.config.ts:**

```typescript
// vitest.config.ts
export default defineConfig({
    test: {
        testTimeout: 10000, // 10 seconds max per test
        hookTimeout: 5000, // 5 seconds for hooks
        teardownTimeout: 5000, // 5 seconds for teardown
        // ... other config
    },
});
```

### Test Organization

1. **Unit Tests**: Place next to source files in `__tests__` directories
2. **Integration Tests**: Use `.integration.test.ts` suffix
3. **Edge Cases**: Use `.edge-cases.test.ts` suffix
4. **Mocks**: Place in `__mocks__` directories

### Test Checklist

Before committing test code, verify:

- [ ] All timers are properly managed (fake timers setup/cleanup)
- [ ] No never-resolving Promises
- [ ] External dependencies are mocked
- [ ] Observables complete properly
- [ ] Tests complete within 10 seconds
- [ ] No global state modifications without cleanup
- [ ] Proper error handling for async operations

### Common Test Utilities

```typescript
// Test helper for timer-based tests
export const withFakeTimers = (testFn: () => Promise<void>) => {
    return async () => {
        vi.useFakeTimers();
        try {
            await testFn();
        } finally {
            vi.useRealTimers();
        }
    };
};

// Usage
it(
    "should handle timers",
    withFakeTimers(async () => {
        // Your test with fake timers
        await vi.runAllTimersAsync();
    }),
);
```

## Debugging

### Rules for Debugging

1. **Don't run the app directly** - Can't verify it properly, give guidance instead
2. **Use logger instead of console.log**
3. **Provide clear reproduction steps**

### Logging

```typescript
import { loggers } from "@common/logger";

// Use appropriate logger
loggers.import.info("Import started");
loggers.scan.debug("Scanning directory", { path: "/some/path" });
loggers.watch.error("Watch error", error);
```

## Build and Deployment

### Building for Production

```bash
# Build for current platform
npm run build

# Build for specific platform
npm run build:win
npm run build:mac
```

### Pre-commit Hooks

The project uses pre-commit hooks to ensure code quality:

- Linting
- Type checking
- Unit tests

If tests hang, refer to the [Testing Guidelines](#testing-guidelines) section above.

## Troubleshooting

### Tests Hanging

If tests hang indefinitely:

1. Check for improper timer management
2. Look for never-resolving Promises
3. Verify external dependencies are mocked
4. Review `docs/issues/test-hanging-issue-resolution.md` for detailed solutions

### Build Issues

1. Reinstall: `rm -rf node_modules && pnpm install`
2. Rust clean build: `cd apps/photasa/src-tauri && cargo clean && cargo build`
3. Lockfile sync: ensure `pnpm-lock.yaml` matches workspace `package.json` files

## Contributing

1. Create feature branch from `develop`
2. Write tests for new features
3. Follow coding standards
4. Create RFC for significant changes
5. Submit PR with clear description

## 架构：贞观服务与 Rust 后端

> **注意**：下文「天界」在 Tauri 中对应 **Rust**（`src-tauri/`、`crates/`），不再使用 contract reference `src/main/` 或 zouwu/Tianshu 工作流（RFC 0153 已移除）。

### 服务层（Vue — 人界）

服务位于 `apps/photasa/src/services/`，神话命名保留。

| 服务                    | 中文     | 职责                                                   |
| ----------------------- | -------- | ------------------------------------------------------ |
| **LishiminService**     | 李世民   | 启奏-圣旨路由、`event-routing.yml`                     |
| **FangXuanLingService** | 房玄龄   | Pinia、奏折 (Zouzhe) 编排                              |
| **DuRuHuiService**      | 杜如晦   | MessageChannel、百姓上书 → 启奏                        |
| **YuanTianGangService** | 袁天罡   | **Tauri `invoke()`**；`executeZhaoling` 直连 Rust 命令 |
| **ChuSuiLiangService**  | 褚遂良   | 偏好 UI                                                |
| **YuChiGongService**    | 尉迟恭   | 扫描队列 UI                                            |
| **ZhangSunWuJiService** | 长孙无忌 | 菜单、Shell                                            |
| **WeiZhengService**     | 魏征     | 文件夹树、AppState                                     |
| **QinQiongService**     | 秦琼     | 文件系统事件                                           |
| **XuanzangService**     | 玄奘     | i18n                                                   |
| **YuShiNanService**     | 虞世南   | 扫描进度                                               |

#### 持久化与 IPC 流程（当前）

```
UI → 奏折 (Zouzhe) → 房玄龄
 → 诏令 (Zhaoling) → 袁天罡.executeZhaoling()
 → Tauri invoke → Rust 命令 (crates/photasa-*)
 → 事件 / Store 同步
```

跨部门协调仍用 **启奏 (Qizou) + 圣旨 (Shengzhi)**；内政持久化用 **奏折 (Zouzhe)**。详见 `CLAUDE.md` 双通信系统说明。

#### 服务边界（仍适用）

1. 服务实现 `IService`，生命周期由李世民管理
2. 服务间经启奏-圣旨，禁止直接互调
3. Store 仅经房玄龄 accessor
4. IPC 仅经袁天罡 / `legacy-api`，禁止裸 `invoke` 散落组件

### Rust 层（天界）

| Crate / 模块                            | 职责                      |
| --------------------------------------- | ------------------------- |
| `photasa-scan`                          | 目录扫描                  |
| `photasa-thumbnail`                     | 缩略图（含 HEIC、FFmpeg） |
| `photasa-preference` / `photasa-config` | 偏好与配置                |
| `photasa-folder-tree`                   | 文件夹树                  |
| `photasa-import` / `photasa-watch`      | 导入与监视                |
| `src-tauri/src/commands/`               | Tauri 命令注册            |

新能力：**Rust 命令 + RFC**，不再添加 `@Adapter` / YAML 工作流。

### UI：图片列表虚拟化

`ImageList.vue` 已使用 **`@tanstack/vue-virtual`**（`useVirtualizer`）按行虚拟化网格；另有 `VirtualizedGrid.vue`、`VirtualList.vue`。无需新 RFC（RFC 0011 / 0148 已覆盖）。

### 如何添加新服务

1. `apps/photasa/src/services/[name]/[name].ts`，实现 `IService`
2. 接口：`apps/photasa/src/interfaces/`
3. 在 `LishiminService` 注册；路由更新 `event-routing.yml`
4. 若需持久化：扩展 `ZOUZHE_MATTERS` + Rust 命令（见 ROADMAP / `.spec/rfc/`）

### 如何添加 Rust 能力

1. 在对应 `crates/photasa-*` 实现逻辑
2. `src-tauri/src/commands/` 暴露 `#[tauri::command]`
3. `main.rs` 注册 handler；capabilities 授权
4. 袁天罡或 `legacy-api.ts` 映射 `invoke` 名
5. `cargo test` + Vitest 覆盖

历史 适配器/天枢工作流文档见 `docs/architecture/MYTHOLOGY.md`（已标 legacy）。

## Resources

- [Debug Guide](DEBUG.md) - Tauri 调试与故障排除
- [MCP Debug](DEBUG_MCP.md) - Tauri MCP 调试
- [Mythology Architecture](architecture/MYTHOLOGY.md) - 神话架构（含 historical参考）
- [RFC / ROADMAP](../ROADMAP.md) - 设计决策与 RFC 索引（canonical）
- [Design Documents](design/) - 架构和设计文档（部分为历史稿）
- [Tauri v2 Documentation](https://v2.tauri.app/)
- [Vue 3 Documentation](https://vuejs.org/)
- [Vitest Documentation](https://vitest.dev/)
