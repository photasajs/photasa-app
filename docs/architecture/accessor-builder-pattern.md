# Accessor + Builder可重用模式指南

> **创建日期**: 2025-10-16
> **作者**: AI Architect (Agent 1 + Validator Agent)
> **参考RFC**: RFC 0042 Step 1
> **Linus原则**: "好品味" - 消除特殊情况，代码简洁优雅

---

## 📋 目录

1. [模式概述](#模式概述)
2. [核心原则](#核心原则)
3. [Accessor模式](#accessor模式)
4. [Builder模式](#builder模式)
5. [双模式架构](#双模式架构)
6. [实施检查清单](#实施检查清单)
7. [测试策略](#测试策略)
8. [最佳实践](#最佳实践)

---

## 模式概述

### 问题陈述

传统的FangXuanLing服务存在问题：
```typescript
// ❌ 旧模式：每个Store都需要在FangXuanLing中添加方法
export class FangXuanLingService {
    getScanningQueue() { /* ... */ }
    addToScanningQueue() { /* ... */ }
    removeFromScanningQueue() { /* ... */ }
    // ... 重复模式，376行代码
}
```

**问题**：
- ❌ 不可扩展：每个新Store需要修改FangXuanLing核心代码
- ❌ 代码冗长：每个Store需要10+个方法
- ❌ 违反开闭原则：对修改开放，对扩展关闭

### 解决方案

**Accessor + Builder双模式架构**：
```typescript
// ✅ 新模式：通过Accessor和Builder解耦
export class FangXuanLingService {
    get scanning() { return this._scanningAccessor; }  // Accessor
    get preference() { return createPreferenceService(); }  // Builder
}
```

**优势**：
- ✅ 高度可扩展：新Store无需修改FangXuanLing
- ✅ 代码简洁：从376行减少到90行
- ✅ 符合开闭原则：对扩展开放，对修改关闭
- ✅ TypeScript类型安全：编译时防止错误

---

## 核心原则

### 1. "好品味"原则 (Linus Torvalds)

**消除特殊情况**：
```typescript
// ❌ 坏品味：每个Store一套方法
getScanningQueue()
getPreferenceData()
getNotificationList()
// ... 无穷无尽

// ✅ 好品味：统一的访问模式
fangXuanLing.scanning.queue
fangXuanLing.preference.currentTheme
fangXuanLing.notification.notifications
```

### 2. 只读访问原则

**外部服务只能读取，不能修改**：
```typescript
// ✅ 正确：只读访问
const queue = fangXuanLing.scanning.queue;
const size = fangXuanLing.scanning.queueSize;

// ❌ 错误：尝试修改（TypeScript阻止）
fangXuanLing.scanning.addToQueue(action);  // 编译错误！
```

### 3. Zouzhe修改原则

**所有修改必须通过Zouzhe系统**：
```typescript
// ✅ 正确：通过Zouzhe修改
const zouzhe: Zouzhe = {
    department: "YuChiGong",
    matter: "ADD_SCAN_TASK",
    content: { action: {...} },
    timestamp: Date.now(),
    priority: ZOUZHE_PRIORITIES.NORMAL
};
await fangXuanLing.processZouzhe(zouzhe);
```

### 4. 单一职责原则

- **Accessor**：只负责读取
- **Builder**：只负责创建服务对象
- **Store**：只负责存储状态
- **Zouzhe**：只负责修改请求

---

## Accessor模式

### 适用场景

**用于运行时状态Store**（如scanningQueue、progressState）：
- 频繁变化的状态
- 不需要复杂业务逻辑
- 纯数据访问

### 实施步骤

#### Step 1: 定义只读接口

```typescript
// src/renderer/src/services/fangxuanling/accessors/[store-name]-accessor.ts

/**
 * [Store描述]访问器接口
 *
 * ⚠️ 只读访问：所有属性都是readonly
 * 修改必须通过Zouzhe系统
 */
export interface I[StoreName]Accessor {
    // 基础属性（readonly）
    readonly [property1]: Type1;
    readonly [property2]: Type2;

    // 计算属性（readonly）
    readonly [computed]: Type3;

    // 查询方法（无副作用）
    [queryMethod](param: Type): ReturnType;
}
```

**关键点**：
- ✅ 所有属性都是`readonly`
- ✅ 没有修改方法（add/remove/update/delete等）
- ✅ 查询方法不修改状态

#### Step 2: 实现Accessor类

```typescript
/**
 * [Store描述]访问器实现
 */
export class [StoreName]Accessor implements I[StoreName]Accessor {
    constructor(private readonly store: [StoreName]Store | null) {}

    // 属性实现：返回副本，防止外部修改
    get [property1](): Type1 {
        if (!this.store) {
            logger.error("🏛️ 房玄龄：[StoreName]Store未初始化");
            return defaultValue;  // 防御性编程
        }
        // ✅ 关键：返回副本！
        return [...this.store.[property1]];
    }

    // 计算属性
    get [computed](): Type3 {
        if (!this.store) return defaultValue;
        return this.store.[computed];
    }

    // 查询方法
    [queryMethod](param: Type): ReturnType {
        if (!this.store) return defaultValue;
        return this.store.[queryMethod](param);
    }
}
```

**关键点**：
- ✅ 防御性编程：检查Store是否初始化
- ✅ 返回副本：防止外部修改
- ✅ 无副作用：不修改Store状态

#### Step 3: 集成到FangXuanLing

```typescript
// src/renderer/src/services/fangxuanling/fangxuanling.ts

import { use[StoreName]Store } from "@renderer/stores/[store-name]";
import { [StoreName]Accessor, type I[StoreName]Accessor } from "./accessors/[store-name]-accessor";

export class FangXuanLingService {
    private _[storeName]Accessor: I[StoreName]Accessor;

    constructor() {
        // 初始化Accessor
        const [storeName]Store = use[StoreName]Store();
        this._[storeName]Accessor = new [StoreName]Accessor([storeName]Store);
        logger.info("📋 房玄龄：[Store描述]Store已就绪");
    }

    /**
     * [Store描述]访问器（只读）
     */
    get [storeName](): I[StoreName]Accessor {
        return this._[storeName]Accessor;
    }
}
```

#### Step 4: 注册到Store Registry

```typescript
// src/renderer/src/services/fangxuanling/store-automation/store-registry.ts

import { use[StoreName]Store } from "@renderer/stores/[store-name]";

const STORE_REGISTRY: StoreRegistry = {
    preferences: usePreferenceStore,
    notification: useNotificationStore,
    photos: usePhotosStore,
    [storeName]: use[StoreName]Store,  // ✅ 新Store注册
};
```

#### Step 5: 编写测试

```typescript
// src/renderer/src/services/fangxuanling/__tests__/[store-name]-accessor.test.ts

describe("FangXuanLing [Store描述]访问器", () => {
    let fangXuanLing: FangXuanLingService;
    let [storeName]Store: [StoreName]Store;

    beforeEach(() => {
        setActivePinia(createPinia());
        fangXuanLing = new FangXuanLingService();
        [storeName]Store = use[StoreName]Store();
    });

    describe("只读属性：[property]", () => {
        it("应该返回副本（防止外部修改）", () => {
            // 通过Store添加数据（模拟Zouzhe修改）
            [storeName]Store.[addMethod]([data]);

            // 通过accessor读取
            const result = fangXuanLing.[storeName].[property];

            // 尝试修改副本
            result.push([newData]);

            // 验证原数据未变
            expect(fangXuanLing.[storeName].[property]).toHaveLength(1);
        });

        it("Store未初始化时应返回默认值", () => {
            const accessor = new [StoreName]Accessor(null);
            expect(accessor.[property]).toEqual([defaultValue]);
        });
    });

    describe("设计原则验证", () => {
        it("accessor应该只提供只读访问，无修改方法", () => {
            const accessor = fangXuanLing.[storeName];

            // 验证没有修改方法
            expect(accessor).not.toHaveProperty("add[Something]");
            expect(accessor).not.toHaveProperty("remove[Something]");
            expect(accessor).not.toHaveProperty("update[Something]");
            expect(accessor).not.toHaveProperty("delete[Something]");
        });
    });
});
```

**测试覆盖要求**：
- ✅ 所有只读属性
- ✅ 所有查询方法
- ✅ Store未初始化场景
- ✅ 返回副本验证
- ✅ 无修改方法验证
- ✅ 目标：100% coverage

---

## Builder模式

### 适用场景

**用于配置类Store**（如preference、settings）：
- 相对稳定的配置
- 需要复杂业务逻辑
- 需要计算属性和方法

### 实施步骤

#### Step 1: 定义服务接口

```typescript
// src/renderer/src/interfaces/fang-xuan-ling.interface.ts

/**
 * [服务描述]接口
 */
export interface I[ServiceName] {
    // 只读属性
    readonly [property1]: Type1;
    readonly [property2]: Type2;

    // 计算属性
    readonly [computed]: Type3;

    // 完整状态访问（只读）
    readonly state: Record<string, unknown>;
}
```

#### Step 2: 实现Builder函数

```typescript
// src/renderer/src/services/fangxuanling/service-builders.ts

import { use[StoreName]Store } from "@renderer/stores/[store-name]";
import type { I[ServiceName] } from "../../interfaces/fang-xuan-ling.interface";

/**
 * 创建[服务描述]
 *
 * @returns I[ServiceName]接口实现
 */
export function create[ServiceName]Service(): I[ServiceName] {
    const store = use[StoreName]Store();

    return {
        // 基础属性（只读访问）
        get [property1]() {
            return store.[property1];
        },

        // 计算属性
        get [computed]() {
            return store.[someComputation];
        },

        // 完整状态访问（只读）
        get state() {
            return store.$state as unknown as Record<string, unknown>;
        },
    };
}
```

**关键点**：
- ✅ 使用getter实现只读
- ✅ 返回接口类型，不暴露Store
- ✅ 可以包含计算逻辑

#### Step 3: 集成到FangXuanLing

```typescript
// src/renderer/src/services/fangxuanling/fangxuanling.ts

import { create[ServiceName]Service } from "./service-builders";
import type { I[ServiceName] } from "@renderer/interfaces/fang-xuan-ling.interface";

export class FangXuanLingService {
    private _[serviceName]?: I[ServiceName];

    /**
     * [服务描述]（Builder模式）
     */
    get [serviceName](): I[ServiceName] {
        if (!this._[serviceName]) {
            this._[serviceName] = create[ServiceName]Service();
        }
        return this._[serviceName];
    }
}
```

**关键点**：
- ✅ 懒加载：首次访问时创建
- ✅ 单例：缓存实例
- ✅ 类型安全：返回接口类型

---

## 双模式架构

### 何时使用Accessor模式

**运行时状态Store**：
- ✅ `ScanningStore` - 扫描队列（频繁变化）
- ✅ `ProgressStore` - 进度状态（实时更新）
- ✅ `CacheStore` - 缓存状态（动态变化）

**特征**：
- 数据频繁变化
- 纯数据访问
- 不需要复杂逻辑

### 何时使用Builder模式

**配置类Store**：
- ✅ `PreferenceStore` - 用户偏好（相对稳定）
- ✅ `SettingsStore` - 应用设置（配置）
- ✅ `ThemeStore` - 主题配置（静态）

**特征**：
- 数据相对稳定
- 需要计算属性
- 包含业务逻辑

### 混合使用

```typescript
export class FangXuanLingService {
    // Accessor模式（运行时状态）
    get scanning(): IScanningAccessor {
        return this._scanningAccessor;
    }

    get progress(): IProgressAccessor {
        return this._progressAccessor;
    }

    // Builder模式（配置）
    get preference(): IPreference {
        return this._preference || (this._preference = createPreferenceService());
    }

    get settings(): ISettings {
        return this._settings || (this._settings = createSettingsService());
    }
}
```

---

## 实施检查清单

### Accessor模式检查清单

- [ ] ✅ 创建`I[StoreName]Accessor`接口（只读）
- [ ] ✅ 实现`[StoreName]Accessor`类（防御式编程）
- [ ] ✅ 所有属性返回副本（防止外部修改）
- [ ] ✅ Store未初始化时返回默认值
- [ ] ✅ 集成到FangXuanLing（getter属性）
- [ ] ✅ 注册到Store Registry
- [ ] ✅ 编写测试（100% coverage）
- [ ] ✅ 验证无修改方法暴露
- [ ] ✅ 零lint错误
- [ ] ✅ TypeScript类型安全

### Builder模式检查清单

- [ ] ✅ 创建`I[ServiceName]`接口（只读）
- [ ] ✅ 实现`create[ServiceName]Service()`函数
- [ ] ✅ 使用getter实现只读访问
- [ ] ✅ 可以包含计算逻辑
- [ ] ✅ 集成到FangXuanLing（懒加载）
- [ ] ✅ 编写测试
- [ ] ✅ 零lint错误
- [ ] ✅ TypeScript类型安全

---

## 测试策略

### Accessor测试模板

```typescript
describe("FangXuanLing [Store]访问器", () => {
    describe("只读属性", () => {
        it("应该返回副本");
        it("Store未初始化时应返回默认值");
    });

    describe("查询方法", () => {
        it("应该正确查询数据");
        it("Store未初始化时应返回默认值");
    });

    describe("设计原则验证", () => {
        it("应该只提供只读访问");
        it("应该与Store状态实时同步");
    });

    describe("集成场景", () => {
        it("应该支持完整的只读查询流程");
    });

    describe("文档说明", () => {
        it("示例：其他服务应该如何修改");
    });
});
```

### 测试覆盖要求

- ✅ **100% Statements**
- ✅ **100% Branches**
- ✅ **100% Functions**
- ✅ **100% Lines**

---

## 最佳实践

### 1. 命名规范

```typescript
// Accessor模式
I[StoreName]Accessor           // 接口
[StoreName]Accessor            // 实现类
_[storeName]Accessor           // 私有成员
get [storeName]()              // 访问器

// Builder模式
I[ServiceName]                 // 接口
create[ServiceName]Service()   // 工厂函数
_[serviceName]                 // 私有成员（可选）
get [serviceName]()            // 访问器
```

### 2. 文件组织

```
src/renderer/src/services/fangxuanling/
├── accessors/                     # Accessor模式
│   ├── scanning-accessor.ts
│   └── progress-accessor.ts
├── service-builders.ts            # Builder模式
├── store-automation/
│   └── store-registry.ts          # Store注册
├── fangxuanling.ts               # 主服务
└── __tests__/
    ├── scanning-accessor.test.ts
    └── service-builders.test.ts
```

### 3. TypeScript类型安全

```typescript
// ✅ 使用接口类型
get scanning(): IScanningAccessor {  // 接口类型
    return this._scanningAccessor;
}

// ❌ 不暴露实现类型
get scanning(): ScanningAccessor {   // 实现类型（错误）
    return this._scanningAccessor;
}
```

### 4. 防御式编程

```typescript
// ✅ 所有Accessor方法都应检查Store
get property(): Type {
    if (!this.store) {
        logger.error("🏛️ 房玄龄：Store未初始化");
        return defaultValue;  // 返回安全的默认值
    }
    return this.store.property;
}
```

### 5. 返回副本

```typescript
// ✅ 返回数组副本
get queue(): ScanAction[] {
    return [...this.store.queue];
}

// ✅ 返回对象副本
get config(): Config {
    return { ...this.store.config };
}

// ✅ 深拷贝（如需要）
get complexData(): ComplexData {
    return JSON.parse(JSON.stringify(this.store.complexData));
}
```

### 6. 日志规范

```typescript
// ✅ 统一日志风格
logger.info("📋 房玄龄：[Store名称]Store已就绪");
logger.error("🏛️ 房玄龄：[Store名称]Store未初始化");
logger.debug("🏛️ 房玄龄：访问[属性名]", value);
```

---

## 示例：完整实现

### 新Store: NotificationQueue

假设我们需要添加一个新的通知队列Store：

#### 1. 创建Store

```typescript
// src/renderer/src/stores/notification-queue.ts
export interface NotificationQueueState {
    queue: Notification[];
    isProcessing: boolean;
}

export const useNotificationQueueStore = defineStore("notificationQueue", {
    state: (): NotificationQueueState => ({
        queue: [],
        isProcessing: false,
    }),
    getters: {
        queueSize: (state) => state.queue.length,
        nextNotification: (state) => state.queue[0] || null,
    },
    actions: {
        addToQueue(notification: Notification) {
            this.queue.push(notification);
        },
        removeFromQueue(id: string) {
            this.queue = this.queue.filter(n => n.id !== id);
        },
    },
    persist: false,
});
```

#### 2. 创建Accessor

```typescript
// src/renderer/src/services/fangxuanling/accessors/notification-queue-accessor.ts
export interface INotificationQueueAccessor {
    readonly queue: Notification[];
    readonly queueSize: number;
    readonly isProcessing: boolean;
    readonly nextNotification: Notification | null;
}

export class NotificationQueueAccessor implements INotificationQueueAccessor {
    constructor(private readonly store: NotificationQueueStore | null) {}

    get queue(): Notification[] {
        if (!this.store) return [];
        return [...this.store.queue];
    }

    get queueSize(): number {
        if (!this.store) return 0;
        return this.store.queueSize;
    }

    get isProcessing(): boolean {
        if (!this.store) return false;
        return this.store.isProcessing;
    }

    get nextNotification(): Notification | null {
        if (!this.store) return null;
        return this.store.nextNotification;
    }
}
```

#### 3. 集成到FangXuanLing

```typescript
// src/renderer/src/services/fangxuanling/fangxuanling.ts
import { NotificationQueueAccessor, type INotificationQueueAccessor } from "./accessors/notification-queue-accessor";

export class FangXuanLingService {
    private _notificationQueueAccessor: INotificationQueueAccessor;

    constructor() {
        const notificationQueueStore = useNotificationQueueStore();
        this._notificationQueueAccessor = new NotificationQueueAccessor(notificationQueueStore);
    }

    get notificationQueue(): INotificationQueueAccessor {
        return this._notificationQueueAccessor;
    }
}
```

#### 4. 注册到Registry

```typescript
// store-registry.ts
const STORE_REGISTRY: StoreRegistry = {
    // ... existing stores
    notificationQueue: useNotificationQueueStore,  // ✅ 新Store
};
```

#### 5. 使用

```typescript
// 任何服务中
const queue = fangXuanLing.notificationQueue.queue;  // 只读
const size = fangXuanLing.notificationQueue.queueSize;

// 修改通过Zouzhe
await fangXuanLing.processZouzhe({
    department: "SomeService",
    matter: "ADD_NOTIFICATION",
    content: { notification: {...} },
});
```

---

## 总结

### 核心优势

1. **高度可扩展** - 新Store无需修改FangXuanLing核心
2. **代码简洁** - 从376行减少到90行/Store
3. **类型安全** - TypeScript编译时防止错误
4. **易于测试** - 100% coverage达成
5. **符合原则** - Linus"好品味"、SOLID原则

### 快速参考

| 模式 | 适用场景 | 实施文件 | 关键特性 |
|------|---------|---------|---------|
| **Accessor** | 运行时状态 | `accessors/[name]-accessor.ts` | 只读、返回副本、防御式 |
| **Builder** | 配置类 | `service-builders.ts` | 懒加载、计算属性、单例 |

### 下一步

- ✅ 使用此模式重构现有Store访问
- ✅ 为新Store使用Accessor或Builder
- ✅ 保持测试覆盖率100%
- ✅ 遵循命名和组织规范

---

**记住Linus的话**："好品味是一种直觉，需要经验积累。消除边界情况永远优于增加条件判断。"
