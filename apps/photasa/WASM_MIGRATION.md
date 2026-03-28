# WASM 迁移指南

## 概述

这是 Photasa Tauri 版本的过渡方案：使用 WASM 运行现有的 TypeScript/JavaScript 代码，然后逐步重写为 Rust。

## 迁移策略

### 阶段 1：WASM 过渡（当前）

1. **识别可迁移代码**
   - 纯计算函数（无 Node.js API 依赖）
   - 工具函数
   - 业务逻辑函数

2. **编译为 WASM**
   - 使用 AssemblyScript 或 wasm-pack
   - 将 TypeScript 代码编译为 WASM

3. **在 Rust 中调用**
   - 使用 `wasmtime` 运行时
   - 通过 Tauri 命令暴露给前端

### 阶段 2：Rust 重写（最终目标）

1. **逐步重写**
   - 将 WASM 模块的功能重写为 Rust
   - 保持 API 兼容性

2. **移除 WASM 依赖**
   - 删除 WASM 模块
   - 移除 wasmtime 依赖

## 使用示例

### 1. 编译 TypeScript 为 WASM

```bash
# 使用 AssemblyScript
npm install -g assemblyscript
asc src/utils/helper.ts --target release
```

### 2. 在 Rust 中加载 WASM

```rust
// 在 Tauri 命令中
let mut cache = wasm_cache.lock().await;
cache.load_module("helper".to_string(), "./helper.wasm").await?;
```

### 3. 调用 WASM 函数

```typescript
// 前端调用
import { invoke } from "@tauri-apps/api/tauri";

const result = await invoke("call_wasm_function", {
  module: "helper",
  function: "deepMerge",
  args: [obj1, obj2]
});
```

## 适合编译为 WASM 的代码

✅ **适合**：
- 纯函数（无副作用）
- 计算密集型逻辑
- 工具函数（deepMerge, 数据转换等）
- 算法实现

❌ **不适合**：
- 文件系统操作（使用 Rust 直接实现）
- 网络请求（使用 Rust 库）
- 系统 API 调用（使用 Tauri API）

## 迁移清单

### 优先级 1：工具函数
- [ ] `deepMergeObjects` - 对象深度合并
- [ ] 路径处理函数
- [ ] 数据转换函数

### 优先级 2：业务逻辑
- [ ] 工作流引擎核心逻辑（部分）
- [ ] 数据验证函数
- [ ] 计算函数

### 优先级 3：完全重写
- [ ] 所有 WASM 模块逐步重写为 Rust
- [ ] 移除 wasmtime 依赖

## 注意事项

1. **性能**：WASM 性能接近原生，但不如纯 Rust
2. **类型转换**：需要处理 JavaScript 和 Rust 类型之间的转换
3. **调试**：WASM 调试比 Rust 代码困难
4. **最终目标**：所有功能最终都应重写为 Rust

## 参考

- [AssemblyScript](https://www.assemblyscript.org/)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/)
- [wasmtime](https://wasmtime.dev/)
