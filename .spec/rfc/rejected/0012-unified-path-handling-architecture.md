# RFC 0012: 统一路径处理架构重构

## 摘要

本RFC提出并实现了一个统一的路径处理架构，解决了项目中路径处理逻辑分散、重复实现、平台兼容性不一致的问题。通过建立清晰的分层架构和统一的API，确保Windows和Mac平台上的路径处理行为一致。

## 背景

### 问题描述

在重构前，项目中存在以下问题：

1. **重复的路径处理逻辑**：在renderer、preload、shared层都有`normalizeFileProtocolPath`函数
2. **不一致的实现**：每个层的实现都不同，导致行为不一致
3. **缺乏统一的入口点**：路径规范化应该在数据流的早期阶段统一处理
4. **平台兼容性问题**：URL编码的路径（如`%3A`）在Windows和Mac上处理不一致
5. **命名不清晰**：函数名`normalizeFileProtocolPath`过于冗长，不够直观

### 影响范围

- 缩略图生成失败（路径URL编码问题）
- 跨平台路径处理不一致
- 代码维护困难
- 测试覆盖不完整
- 长路径处理问题（浏览器URL长度限制）

## 设计目标

1. **统一性**：所有路径处理都使用相同的逻辑和API
2. **简洁性**：使用更简洁的函数名和清晰的架构
3. **平台无关**：使用Node.js标准API确保跨平台兼容性
4. **类型安全**：通过TypeScript确保路径处理的类型安全
5. **易于维护**：统一的命名和架构，便于后续维护
6. **长路径支持**：避免浏览器URL长度限制，使用系统路径进行文件操作

## 设计方案

### 核心原则

1. **单一职责**：每个层只负责自己应该处理的路径转换
2. **统一入口**：所有路径规范化都通过shared层的统一API
3. **平台无关**：使用Node.js标准API确保跨平台兼容性
4. **类型安全**：通过TypeScript确保路径处理的类型安全

### 分层架构

```
┌─────────────────┐
│   Renderer层    │  ← 使用 file:// 协议路径，通过preload API转换
├─────────────────┤
│   Preload层     │  ← 路径格式转换层：file:// ↔ 系统路径
├─────────────────┤
│   Shared层      │  ← 提供统一的路径处理API，支持所有格式
├─────────────────┤
│   Main层        │  ← 使用系统路径（Windows/Mac原生格式）
└─────────────────┘
```

### 路径格式规范

| 层级         | 输入格式       | 输出格式       | 说明                           |
| ------------ | -------------- | -------------- | ------------------------------ |
| **Renderer** | `file://` 协议 | `file://` 协议 | 用于UI显示和用户交互           |
| **Preload**  | `file://` 协议 | 系统路径       | 格式转换层，处理协议转换       |
| **Shared**   | 任意格式       | 系统路径       | 统一处理，支持所有输入格式     |
| **Main**     | 系统路径       | 系统路径       | 文件系统操作，使用原生路径格式 |

### 路径转换流程

#### 1. Renderer → Preload → Main 流程

```
Renderer层: file:///C%3A/Users/图片/photo.jpg
     ↓ (通过 window.api.normalizePath)
Preload层:  C:\Users\图片\photo.jpg (Windows) 或 C:/Users/图片/photo.jpg (跨平台)
     ↓ (通过 IPC 传递给 Main)
Main层:     C:\Users\图片\photo.jpg (Windows) 或 /Users/图片/photo.jpg (Mac)
```

#### 2. 特殊字符处理示例

| 输入 (file:// 协议)                  | Windows 输出              | Mac 输出                  | 说明     |
| ------------------------------------ | ------------------------- | ------------------------- | -------- |
| `file:///C%3A/Users/图片/photo.jpg`  | `C:\Users\图片\photo.jpg` | `C:/Users/图片/photo.jpg` | 中文路径 |
| `file:///C%3A/Users/test%20file.jpg` | `C:\Users\test file.jpg`  | `C:/Users/test file.jpg`  | 空格处理 |
| `file:///C%3A/Users/file%40name.jpg` | `C:\Users\file@name.jpg`  | `C:/Users/file@name.jpg`  | 特殊符号 |
| `file:///Users/图片/photo.jpg`       | `C:\Users\图片\photo.jpg` | `/Users/图片/photo.jpg`   | Mac 路径 |

### API设计

#### Shared层 - 核心API

```typescript
/**
 * 规范化文件路径，处理所有格式的路径输入
 * 这是项目中路径处理的统一入口点，确保所有路径都使用相同的规范化逻辑
 * 支持 file:// URL、普通文件路径、相对路径等所有格式
 * @param input 输入路径 - 可能是 file:// URL、普通文件路径或相对路径
 * @returns 规范化的文件系统绝对路径
 */
export function normalizePath(input: string | URL): string;
```

#### Preload层 - 统一入口

```typescript
// 直接使用shared层的API，不进行额外包装
import { normalizePath } from "@shared/path-util";
```

#### Renderer层 - 代理调用

```typescript
/**
 * 规范化文件路径，处理所有格式的路径输入
 * 通过 preload 层调用统一的路径处理 API，确保正确处理 Windows 和 macOS 格式
 * @param input 输入路径 - 可能是 file:// URL 或普通文件路径
 * @returns 规范化的文件系统路径
 */
export function normalizePath(input: string): string {
    return window.api.normalizePath?.(input) || input;
}
```

### 实现细节

#### 1. 统一函数命名

- **旧名称**：`normalizeFileProtocolPath`
- **新名称**：`normalizePath`
- **原因**：更简洁、更直观，涵盖所有路径格式

#### 2. 使用Node.js标准API

```typescript
// 使用Node.js标准API确保跨平台兼容性
import { fileURLToPath } from "url";
import { pathToFileURL } from "url";

export function normalizePath(input: string | URL): string {
    if (!input) return "";

    let pathStr = typeof input === "string" ? input : input.toString();

    try {
        if (pathStr.startsWith("file://")) {
            // 使用Node.js标准API转换file:// URL为文件系统路径
            // 自动处理URL编码（如 %3A -> :）和特殊字符（如中文、空格等）
            pathStr = fileURLToPath(pathStr);
        }
        return path.resolve(pathStr);
    } catch (error) {
        console.warn(
            "Failed to normalize path using Node.js API, falling back to manual processing:",
            error,
        );
        return path.resolve(pathStr);
    }
}
```

#### 3. 特殊字符和中文处理

Node.js的`fileURLToPath`函数自动处理：

- **URL编码**：`%3A` → `:`，`%20` → 空格
- **中文字符**：`%E5%9B%BE%E7%89%87` → `图片`
- **特殊符号**：`%40` → `@`，`%23` → `#`
- **跨平台路径**：Windows的`C:\`和Mac的`/Users/`

示例：

```typescript
// Windows路径处理
normalizePath("file:///C%3A/Users/图片/photo.jpg");
// 结果: "C:\Users\图片\photo.jpg" (Windows) 或 "C:/Users/图片/photo.jpg" (跨平台)

// Mac路径处理
normalizePath("file:///Users/图片/photo.jpg");
// 结果: "/Users/图片/photo.jpg"

// 特殊字符处理
normalizePath("file:///C%3A/Users/test%40example.com/file%23name.jpg");
// 结果: "C:\Users\test@example.com\file#name.jpg"
```

#### 4. 清理重复代码

- 删除`fileUrlToPath`函数（功能已被`normalizePath`覆盖）
- 移除renderer层的重复实现
- 统一所有层的函数调用

#### 5. 长路径处理策略

**问题**：浏览器对URL长度有限制（通常2KB-8KB），长文件路径可能导致问题。

**解决方案**：

- **Renderer层**：仅用于UI显示，不直接操作文件
- **Preload层**：立即将`file://`协议转换为系统路径
- **Main层**：使用系统路径进行所有文件操作，无长度限制

**优势**：

- 避免浏览器URL长度限制
- 支持任意长度的文件路径
- 提高文件操作性能

#### 6. 更新所有使用点

- scan-worker使用统一的路径处理
- 所有测试文件都已更新
- 所有导入和导出都已统一

## 实施计划

### 阶段1：统一shared层API ✅

- [x] 重命名`normalizeFileProtocolPath`为`normalizePath`
- [x] 使用Node.js标准API实现
- [x] 更新所有内部调用

### 阶段2：更新preload层 ✅

- [x] 简化preload层实现，直接使用shared层API
- [x] 删除重复的`fileUrlToPath`函数
- [x] 更新所有使用点

### 阶段3：更新renderer层 ✅

- [x] 简化renderer层实现，通过preload API调用
- [x] 移除重复的路径处理逻辑

### 阶段4：更新main层 ✅

- [x] 更新scan-worker使用统一API
- [x] 确保所有路径传递点都使用规范化路径

### 阶段5：更新测试 ✅

- [x] 更新所有测试文件使用新函数名
- [x] 确保测试覆盖完整

## 测试策略

### 单元测试

```typescript
describe("normalizePath", () => {
    describe("URL编码路径处理", () => {
        it("should decode URL-encoded Windows paths", () => {
            const encodedPath =
                "file:///C%3A/Users/alber/Desktop/Test/2024/20240101/20240102_051203000_iOS.jpg";
            const result = normalizePath(encodedPath);
            expect(result).toContain(
                "Users/alber/Desktop/Test/2024/20240101/20240102_051203000_iOS.jpg",
            );
        });

        it("should handle URL-encoded special characters", () => {
            const encodedPath = "file:///C%3A/Users/test%20file%40name.jpg";
            const result = normalizePath(encodedPath);
            expect(result).toContain("test file@name.jpg");
        });
    });

    describe("中文路径处理", () => {
        it("should handle Chinese characters in Windows paths", () => {
            const chinesePath = "file:///C%3A/Users/图片/照片.jpg";
            const result = normalizePath(chinesePath);
            expect(result).toContain("图片/照片.jpg");
        });

        it("should handle Chinese characters in Mac paths", () => {
            const chinesePath = "file:///Users/图片/照片.jpg";
            const result = normalizePath(chinesePath);
            expect(result).toBe("/Users/图片/照片.jpg");
        });

        it("should handle mixed Chinese and English characters", () => {
            const mixedPath = "file:///C%3A/Users/图片/photo%20照片.jpg";
            const result = normalizePath(mixedPath);
            expect(result).toContain("图片/photo 照片.jpg");
        });
    });

    describe("跨平台路径处理", () => {
        it("should handle Mac paths correctly", () => {
            const macPath = "file:///Users/test/photo.jpg";
            const result = normalizePath(macPath);
            expect(result).toBe("/Users/test/photo.jpg");
        });

        it("should handle Windows paths correctly", () => {
            const windowsPath = "file:///C:/Users/test/photo.jpg";
            const result = normalizePath(windowsPath);
            expect(result).toContain("Users/test/photo.jpg");
        });

        it("should handle relative paths", () => {
            const relativePath = "./photos/image.jpg";
            const result = normalizePath(relativePath);
            expect(result).toContain("photos/image.jpg");
        });
    });

    describe("长路径处理", () => {
        it("should handle very long Windows paths", () => {
            // 生成一个很长的路径（超过浏览器URL限制）
            const longPath = "C:/" + "very/long/path/".repeat(50) + "image.jpg";
            const fileProtocolPath = `file:///${longPath.replace(/\\/g, "/")}`;
            const result = normalizePath(fileProtocolPath);
            expect(result).toContain("very/long/path");
            expect(result.length).toBeGreaterThan(1000);
        });

        it("should handle long paths with Chinese characters", () => {
            const longChinesePath = "C:/" + "很长的路径/包含中文/".repeat(30) + "图片.jpg";
            const fileProtocolPath = `file:///${longChinesePath.replace(/\\/g, "/")}`;
            const result = normalizePath(fileProtocolPath);
            expect(result).toContain("很长的路径");
            expect(result).toContain("包含中文");
        });

        it("should handle deep nested directory structures", () => {
            const deepPath = "C:/" + "level".repeat(100).split("").join("/") + "/file.jpg";
            const fileProtocolPath = `file:///${deepPath.replace(/\\/g, "/")}`;
            const result = normalizePath(fileProtocolPath);
            expect(result).toContain("level");
        });
    });

    describe("错误处理", () => {
        it("should handle malformed URLs gracefully", () => {
            const malformedPath = "file:///C%3G/Users/test/image.jpg";
            const result = normalizePath(malformedPath);
            expect(result).toContain("C%3G/Users/test/image.jpg");
        });

        it("should handle empty input", () => {
            expect(normalizePath("")).toBe("");
            expect(normalizePath(null as any)).toBe("");
            expect(normalizePath(undefined as any)).toBe("");
        });
    });
});
```

### 集成测试

- 测试缩略图生成流程
- 测试跨平台路径处理
- 测试URL编码路径处理

## 向后兼容性

### 破坏性变更

1. **函数重命名**：`normalizeFileProtocolPath` → `normalizePath`
2. **删除函数**：`fileUrlToPath`函数已删除
3. **API变更**：renderer层API签名保持不变，但内部实现简化

### 迁移指南

```typescript
// 旧代码
import { normalizeFileProtocolPath } from "./path-util";
const normalizedPath = normalizeFileProtocolPath(input);

// 新代码
import { normalizePath } from "./path-util";
const normalizedPath = normalizePath(input);
```

## 性能影响

### 正面影响

1. **减少重复代码**：删除了重复的路径处理逻辑
2. **统一API**：减少了函数调用层次
3. **标准API**：使用Node.js标准API，性能更稳定
4. **长路径支持**：避免浏览器URL长度限制，支持任意长度路径
5. **内存优化**：系统路径比URL编码路径更短，减少内存使用

### 性能测试

- 路径规范化性能测试
- 内存使用优化
- 跨平台性能对比
- 长路径处理性能测试
- 浏览器URL长度限制测试

## 风险评估

### 低风险

1. **API变更**：函数重命名，但功能保持不变
2. **测试覆盖**：所有使用点都有测试覆盖
3. **向后兼容**：renderer层API保持兼容

### 缓解措施

1. **完整测试**：确保所有路径处理场景都有测试
2. **渐进式部署**：可以分阶段部署
3. **回滚计划**：保留旧函数名作为别名（如果需要）

## 监控和指标

### 关键指标

1. **路径处理成功率**：确保所有路径都能正确规范化
2. **跨平台一致性**：Windows和Mac上的行为一致
3. **性能指标**：路径处理性能不应下降
4. **长路径处理成功率**：确保长路径（>2KB）能正确处理
5. **内存使用效率**：系统路径vs URL编码路径的内存使用对比

### 监控方法

1. **日志监控**：记录路径处理错误
2. **性能监控**：监控路径处理耗时
3. **用户反馈**：收集用户关于路径问题的反馈
4. **长路径监控**：记录超过特定长度的路径处理情况
5. **内存监控**：监控路径字符串的内存使用情况

## 结论

通过实施统一的路径处理架构，我们解决了以下问题：

1. ✅ **统一了路径处理逻辑**：所有层都使用相同的API
2. ✅ **提高了代码质量**：删除了重复代码，简化了架构
3. ✅ **增强了平台兼容性**：使用Node.js标准API确保跨平台一致性
4. ✅ **改善了开发体验**：更简洁的API和清晰的架构
5. ✅ **确保了类型安全**：通过TypeScript确保路径处理的类型安全
6. ✅ **解决了长路径问题**：避免浏览器URL长度限制，支持任意长度路径
7. ✅ **优化了内存使用**：系统路径比URL编码路径更高效

这个重构为项目提供了一个稳定、可维护、跨平台的路径处理基础，为后续的功能开发奠定了良好的基础。

## 相关文档

- [路径处理解耦与多平台兼容性重构设计](../design/20250704-path-helper-refactor.md)
- [路径服务UI解耦设计](../design/20250704-path-service-ui-decoupling.md)
- [CSS变量标准化](../design/20250704-css-variable-standard.md)

## 变更记录

| 版本 | 日期       | 变更内容                       |
| ---- | ---------- | ------------------------------ |
| 1.0  | 2025-01-10 | 初始版本，统一路径处理架构重构 |
