# Development Guide

## Table of Contents

- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Debugging](#debugging)
- [Build and Deployment](#build-and-deployment)

## Project Structure

This is an Electron + Vite application with TypeScript, targeting Windows and Mac desktop platforms.

```
picasa-vue/
├── apps/
│   └── desktop/        # Electron 应用 (@photasa/desktop)
│       ├── src/main/       # 主进程
│       ├── src/preload/    # 预加载脚本
│       └── src/renderer/   # Vue 前端
├── packages/
│   ├── common/         # 共享工具 (@photasa/common) - 私有
│   └── @photasa/       # 公共/共享包
│       └── tianshu/    # 工作流引擎 (@photasa/tianshu)
├── docs/               # 文档
└── resources/          # 静态资源
```

### 包结构说明

- **`@photasa/common`** (`packages/common`):
    - 私有工具包，供应用的所有部分（Main, Preload, Renderer）使用。
    - 包含类型定义、配置、日志记录器和工具函数。
    - **导入规则**: 必须从 `@photasa/common` 导入，**严禁**使用 `../../common` 等相对路径。
    - 示例: `import { config } from "@photasa/common"`

- **`@photasa/tianshu`** (`packages/@photasa/tianshu`):
    - 公共工作流引擎包。
    - 从 `@systembug/tianshu` 迁移而来。
    - **导入规则**: 从 `@photasa/tianshu` 导入。

### 跨进程代码共享与构建策略

Photasa 根据包的用途采用不同的构建策略：

#### 1. 同构包 (Isomorphic Packages) - 如 `@photasa/common`

由于 `common` 包同时被 **Main** (Node.js) 和 **Renderer** (Browser) 进程使用，我们采用 **源码打包策略 (Source Bundling Strategy)**：

- **配置**: `package.json` 的 `main` 指向 `./src/index.ts`。
- **构建**: 消费端 (`apps/desktop`) 的构建工具 (`electron-vite`) 负责将其转译为目标环境的代码 (CJS 或 ESM)。
- **注意**: 在 `electron.vite.config.ts` 中需将其**排除**在外部依赖之外。

#### 2. 主进程专用包 (Main-Process Packages) - 如 `@photasa/tianshu`

对于仅在 Node.js 环境（Main 进程）运行的包，我们采用 **标准打包策略 (Standard Packaging Strategy)**：

- **配置**: `package.json` 的 `main` 指向编译后的 `./dist/index.js`。
- **构建**: 包自身负责构建 (`pnpm build`)，消费端将其视为普通 NPM 依赖。
- **注意**: 包含原生依赖或仅限 Node 的逻辑。

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Installation

```bash
npm install
```

### Running Development

```bash
npm run dev
```

### Running Tests

```bash
npm test
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
4. **Document using RFCs** - Read `docs/rfc/README.md` for RFC management

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

1. Clear node_modules and reinstall: `rm -rf node_modules && npm install`
2. Clear Electron cache: `npm run clear-cache`
3. Check Node.js version compatibility

## Contributing

1. Create feature branch from `develop`
2. Write tests for new features
3. Follow coding standards
4. Create RFC for significant changes
5. Submit PR with clear description

## 架构：服务和适配器

### 服务层 (Renderer 进程 - 人界)

服务位于 `src/renderer/src/services/`，遵循唐朝神话命名规范。

#### 服务职责

| 服务名称                | 中文名称 | 位置            | 主要职责                                    | 核心功能                                                                      |
| ----------------------- | -------- | --------------- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| **LishiminService**     | 李世民   | `lishimin/`     | 中央协调者，应用启动，启奏-圣旨路由         | - 服务初始化<br>- 通过 `event-routing.yml` 进行启奏路由<br>- 应用生命周期管理 |
| **FangXuanLingService** | 房玄龄   | `fangxuanling/` | Store 管理，奏折处理，天枢编排              | - Pinia Store 访问器<br>- 奏折 (Zouzhe) 到天枢<br>- 状态管理协调              |
| **DuRuHuiService**      | 杜如晦   | `duruhui/`      | MessageChannel 管理，圣旨传递，DOM 事件监听 | - MessageChannel 创建<br>- 圣旨 (Shengzhi) 传递<br>- DOM 事件转换为启奏       |
| **YuanTianGangService** | 袁天罡   | `yuantiangang/` | Renderer 和 Main 进程间的 IPC 桥梁          | - 诏令 (Zhaoling) 转换为符箓 (Fulu)<br>- 天枢引擎通信<br>- IPC 事件处理       |
| **ChuSuiLiangService**  | 褚遂良   | `chusuiliang/`  | 偏好设置 UI 管理                            | - 主题管理<br>- 语言设置<br>- 路径管理                                        |
| **YuChiGongService**    | 尉迟恭   | `yuchigong/`    | 扫描队列 UI 管理                            | - 队列状态显示<br>- 扫描进度监控                                              |
| **ZhangSunWuJiService** | 长孙无忌 | `zhangsunwuji/` | 菜单管理和 Shell 操作                       | - 菜单状态管理<br>- `openExternal()` / `openInFinder()`<br>- 菜单操作路由     |
| **WeiZhengService**     | 魏征     | `weizheng/`     | AppState 监控和文件夹树管理                 | - 文件夹树更新<br>- AppState 验证                                             |
| **QinQiongService**     | 秦琼     | `qinqiong/`     | 文件系统事件守护者                          | - 文件系统事件路由<br>- 事件协调                                              |
| **XuanzangService**     | 玄奘     | `xuanzang/`     | 国际化                                      | - 多语言支持<br>- 语言环境管理                                                |
| **YuShiNanService**     | 虞世南   | `yushinan/`     | 扫描进度显示                                | - 进度监控<br>- 状态报告                                                      |

#### 服务通信流程

```
UI 组件 (百姓)
    ↓ DOM 事件 (picasa:shangshu)
DuRuHuiService (杜如晦)
    ↓ 转换为启奏 (Qizou)
QiZouRouter (李世民路由器)
    ↓ 通过 event-routing.yml 路由
    ↓ 下发圣旨 (Shengzhi)
目标服务 (通过 MessageChannel)
    ↓ 执行操作
    ↓ 如需要，发送启奏 (Qizou)
QiZouRouter
    ↓ 路由到房玄龄
FangXuanLingService
    ↓ 转换为奏折 (Zouzhe)
YuanTianGangService (袁天罡)
    ↓ 转换为符箓 (Fulu)
Tianshu Engine (天枢)
    ↓ 执行工作流
```

#### 服务边界规则

**清晰的边界：**

1. **服务必须实现 `IService` 接口** - 提供生命周期管理
2. **服务通过启奏-圣旨通信** - 服务间禁止直接方法调用
3. **仅通过房玄龄访问 Store** - 服务不能直接访问 Pinia stores
4. **DOM 事件由杜如晦处理** - UI 组件分发事件，杜如晦转换为启奏
5. **仅通过袁天罡进行 IPC 通信** - 服务不能直接使用 `window.api`

**如何修复边界违规：**

- ❌ **错误**：从 `serviceB` 直接调用 `serviceA.doSomething()`
- ✅ **正确**：`serviceB` 发送启奏 → 路由器 → 向 `serviceA` 下发圣旨
- ❌ **错误**：在服务中直接访问 `store.value`
- ✅ **正确**：使用 `fangXuanLingService.getAccessor('storeName')`
- ❌ **错误**：在服务中使用 `window.api.openExternal()`
- ✅ **正确**：发送启奏 → 路由到长孙无忌 → 袁天罡 → 天枢

### 适配器层 (Main 进程 - 天界)

适配器位于 `src/engines/adapters/`，使用 `@Adapter` 装饰器注册到太乙引擎。

#### 适配器职责

| 适配器名称               | 中文名称 | 位置                      | 主要职责             | 支持的操作                                                                                                                                                                                                                                                                           |
| ------------------------ | -------- | ------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **BuiltinAdapter**       | 内置操作 | `BuiltinAdapter.ts`       | 内置工作流操作       | - `return` - 返回工作流结果<br>- `setVariable` - 设置工作流变量<br>- `log` - 日志记录<br>- `delay` - 延迟执行<br>- `noop` - 空操作<br>- `objectMerge` - 对象合并<br>- `arrayAppend` - 数组追加<br>- `arrayFilter` - 数组过滤<br>- `arrayCount` - 数组计数<br>- `arraySet` - 数组设值 |
| **WenchangAdapter**      | 文昌     | `WenchangAdapter.ts`      | 用户偏好管理         | - `getCurrentSnapshot` - 获取偏好<br>- `applyDelta` - 更新偏好<br>- `getRevision` - 获取版本号<br>- `getHistory` - 获取偏好历史                                                                                                                                                      |
| **QianliyanAdapter**     | 千里眼   | `QianliyanAdapter.ts`     | 文件扫描操作         | - `scanFolder` - 扫描目录<br>- `getScanStatus` - 获取扫描状态<br>- `cancelScan` - 取消扫描<br>- `getScanQueue` - 获取扫描队列                                                                                                                                                        |
| **SimingAdapter**        | 司命     | `SimingAdapter.ts`        | AppState 持久化      | - `saveAppState` - 保存应用状态<br>- `loadAppState` - 加载应用状态<br>- `updateFolderTree` - 更新文件夹树                                                                                                                                                                            |
| **TaibaijinxingAdapter** | 太白金星 | `TaibaijinxingAdapter.ts` | Shell 操作和菜单管理 | - `openExternal` - 打开外部链接<br>- `openInFinder` - 在 Finder 中显示文件<br>- `updateMenu` - 更新应用菜单                                                                                                                                                                          |

#### 适配器注册

所有适配器通过 `src/engines/adapters/index.ts` 导入时自动注册：

```typescript
// src/engines/adapters/index.ts
import "./BuiltinAdapter";
import "./WenchangAdapter";
import "./QianliyanAdapter";
import "./SimingAdapter";
import "./TaibaijinxingAdapter";
```

`@Adapter` 装饰器处理注册：

```typescript
@Adapter({
    name: "adapter-name",
    displayName: "显示名称",
    priority: AdapterPriority.High,
    description: "适配器描述",
    engineType: "type",
    dependencies: [],
    retryOnFailure: true,
    maxRetries: 3,
})
export class MyAdapter implements IAdapter {
    // 实现
}
```

#### 适配器边界规则

**清晰的边界：**

1. **适配器必须实现 `IAdapter` 接口** - 提供 `initialize()` 和 `shutdown()`
2. **适配器通过 `@Adapter` 装饰器注册** - 导入时自动注册
3. **适配器由太乙引擎调用** - 服务不能直接调用适配器
4. **适配器接受工作流步骤输入** - 参数来自工作流 YAML
5. **适配器返回工作流步骤输出** - 结果流向下一个工作流步骤

**如何修复边界违规：**

- ❌ **错误**：在服务中直接实例化适配器
- ✅ **正确**：使用天枢工作流 → 太乙 → 适配器
- ❌ **错误**：适配器直接调用另一个适配器
- ✅ **正确**：使用工作流步骤链式调用适配器
- ❌ **错误**：适配器访问 renderer 进程 API
- ✅ **正确**：适配器仅使用 Node.js/Electron main 进程 API

### 名称映射：神话名称到代码

#### Renderer 服务 (人界)

| 神话名称 | 服务类                | 文件路径                                | Token/接口              |
| -------- | --------------------- | --------------------------------------- | ----------------------- |
| 李世民   | `LishiminService`     | `services/lishimin/lishimin.ts`         | `ILishiminService`      |
| 房玄龄   | `FangXuanLingService` | `services/fangxuanling/fangxuanling.ts` | `FANG_XUAN_LING_TOKEN`  |
| 杜如晦   | `DuRuHuiService`      | `services/duruhui/duruhui.ts`           | N/A (内部使用)          |
| 袁天罡   | `YuanTianGangService` | `services/yuantiangang/yuantiangang.ts` | `YUAN_TIAN_GANG_TOKEN`  |
| 褚遂良   | `ChusuiliangService`  | `services/chusuiliang/chusuiliang.ts`   | `CHU_SUI_LIANG_TOKEN`   |
| 尉迟恭   | `YuChiGongService`    | `services/yuchigong/yuchigong.ts`       | `YU_CHI_GONG_TOKEN`     |
| 长孙无忌 | `ZhangSunWuJiService` | `services/zhangsunwuji/zhangsunwuji.ts` | `ZHANG_SUN_WU_JI_TOKEN` |
| 魏征     | `WeiZhengService`     | `services/weizheng/weizheng.ts`         | `WEI_ZHENG_TOKEN`       |
| 秦琼     | `QinQiongService`     | `services/qinqiong/qinqiong.ts`         | `QIN_QIONG_TOKEN`       |
| 玄奘     | `XuanzangService`     | `services/xuanzang/xuanzang.ts`         | `XUANZANG_TOKEN`        |
| 虞世南   | `YuShiNanService`     | `services/yushinan/yushinan.ts`         | `YU_SHINAN_TOKEN`       |

#### Main 进程适配器 (天界)

| 神话名称 | 适配器类               | 文件路径                                   | 引擎类型     |
| -------- | ---------------------- | ------------------------------------------ | ------------ |
| 内置操作 | `BuiltinAdapter`       | `engines/adapters/BuiltinAdapter.ts`       | `builtin`    |
| 文昌     | `WenchangAdapter`      | `engines/adapters/WenchangAdapter.ts`      | `preference` |
| 千里眼   | `QianliyanAdapter`     | `engines/adapters/QianliyanAdapter.ts`     | `scan`       |
| 司命     | `SimingAdapter`        | `engines/adapters/SimingAdapter.ts`        | `appstate`   |
| 太白金星 | `TaibaijinxingAdapter` | `engines/adapters/TaibaijinxingAdapter.ts` | `shell`      |

#### Main 进程引擎 (天界)

| 神话名称 | 引擎类             | 文件路径                                      | 状态      |
| -------- | ------------------ | --------------------------------------------- | --------- |
| 天枢     | `TianshuEngine`    | `engines/tianshu/core/TianshuEngine.ts`       | ✅ 已实现 |
| 太乙     | `TaiyiEngine`      | `engines/taiyi/core/TaiyiEngine.ts`           | ✅ 已实现 |
| 千里眼   | `QianliyanEngine`  | `engines/qianliyan/core/QianliyanEngine.ts`   | ✅ 已实现 |
| 顺风耳   | `ShunfengerEngine` | `engines/shunfenger/core/ShunfengerEngine.ts` | ✅ 已实现 |
| 司命     | `SimingEngine`     | `engines/siming/core/SimingEngine.ts`         | ✅ 已实现 |
| 司簿     | `SibuEngine`       | `engines/sibu/core/SibuEngine.ts`             | ✅ 已实现 |
| 文昌     | `WenchangEngine`   | `engines/wenchang/core/WenchangEngine.ts`     | ✅ 已实现 |
| 马良     | `MaLiangEngine`    | `engines/maliang/core/MaLiangEngine.ts`       | ✅ 已实现 |
| 玲珑     | `LinglongEngine`   | `engines/linglong/`                           | 🚧 规划中 |

### 如何添加新服务

1. **创建服务文件**：`src/renderer/src/services/[name]/[name].ts`
2. **实现 `IService` 接口**：
    ```typescript
    export class MyService implements IService {
        readonly name = "服务名称";
        async initialize(): Promise<void> {}
        async shutdown(): Promise<void> {}
        setQizouBus(bus: Emitter<{ qizou: Qizou }>): void {}
        setShengzhiPort(port: MessagePort): void {}
    }
    ```
3. **在 `LishiminService` 中注册**：添加到服务初始化
4. **创建接口**：`src/renderer/src/interfaces/[name].interface.ts`
5. **添加路由规则**：更新 `src/renderer/src/services/lishimin/event-routing.yml`

### 如何添加新适配器

1. **创建适配器文件**：`src/engines/adapters/[Name]Adapter.ts`
2. **实现 `IAdapter` 接口**：
    ```typescript
    @Adapter({
        name: "adapter-name",
        displayName: "显示名称",
        priority: AdapterPriority.High,
        description: "描述",
        engineType: "type",
    })
    export class MyAdapter implements IAdapter {
        readonly name = "adapter-name";
        async initialize(): Promise<void> {}
        async shutdown(): Promise<void> {}
        // 添加操作方法
    }
    ```
3. **在 index 中导入**：添加到 `src/engines/adapters/index.ts`
4. **创建工作流 YAML**：在 `src/engines/tianshu/workflows/` 中添加工作流文件

## Resources

- [Debug Guide](DEBUG.md) - 调试设置和故障排除
- [Mythology Architecture](architecture/MYTHOLOGY.md) - 神话架构详细说明
- [RFC Index](rfc/README.md) - 设计决策和RFC文档
- [Design Documents](design/) - 架构和设计文档
- [Electron Documentation](https://www.electronjs.org/docs)
- [Vue 3 Documentation](https://vuejs.org/)
- [Vite Documentation](https://vitejs.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
