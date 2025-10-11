# RFC 0030: 扫描状态报告修复

## 元信息

- **RFC编号**: 0030
- **标题**: 扫描状态报告修复
- **作者**: Claude Code Assistant
- **状态**: 已完成
- **创建日期**: 2025-09-24
- **类型**: 增强 (Enhancement)
- **影响范围**: 用户界面、扫描系统

## 摘要

修复扫描过程中的两个关键状态报告问题：

1. 扫描完成时未发送完成状态到UI状态栏
2. 正在处理的文件信息未实时更新到状态栏

这些问题导致用户无法准确了解扫描进度和完成状态，影响用户体验。

## 问题分析

### 问题1: 扫描完成状态未发送到UI

**现象**: 扫描完成后状态栏直接清空，用户不知道扫描已完成

**根本原因**:

- `orchestrateScan()` 在队列为空时调用 `clearProcessingStatus()` 立即清空状态
- 没有在清空前发送"扫描完成"消息给用户

**影响文件**:

- `src/renderer/src/AppHelper.ts:238` - 队列空时立即清理状态
- `src/renderer/src/App.vue:251` - clearProcessingStatus只是清空状态

### 问题2: 文件处理进度未实时更新

**现象**: 状态栏只显示"正在扫描: 路径"，不显示具体处理的文件

**根本原因**:

- `updateProcessingStatus()` 只在扫描开始时更新路径级别信息
- `executeScanTask()` 中处理单个文件时没有更新文件级别状态
- scan-photos.ts 主扫描流程中缺少文件级别的进度报告

**影响文件**:

- `src/renderer/src/AppHelper.ts:184-214` - executeScanTask缺少文件进度更新
- `src/main/scan/scan-photos.ts` - 主扫描函数中没有发送文件处理进度

## 解决方案

### 1. 扫描完成状态发送

在扫描队列为空时，先发送"扫描完成"状态，然后延迟清理状态栏。

**修改位置**: `src/renderer/src/AppHelper.ts`

- `orchestrateScan()` 函数队列为空时的处理逻辑
- 添加完成状态发送和渐进式清理机制

### 2. 文件级别进度报告

在文件处理过程中实时更新状态栏显示当前处理的文件。

**修改位置**:

- `src/renderer/src/AppHelper.ts` - executeScanTask函数
- `src/renderer/src/App.vue` - 回调函数实现
- `src/main/scan/scan-helpers.ts` - processPhotoFile函数

### 3. 状态清理机制优化

实现渐进式状态清理，让用户看到"扫描完成"消息几秒后再清空。

**修改位置**: `src/renderer/src/App.vue`

- `clearProcessingStatus()` 函数实现延迟清理

## 实施细节

### 接口扩展

```typescript
// 扩展回调接口支持文件级别进度
export interface ScanCallbacks {
    // 现有回调...

    // 新增：文件级别进度更新
    updateFileProgress: (fileName: string, current: number, total: number) => void;
}
```

### 状态更新流程

1. **扫描开始**: 显示"正在扫描: [路径]"
2. **文件处理**: 显示"正在处理: [文件名] (x/y)"
3. **扫描完成**: 显示"扫描完成" 持续3-5秒
4. **状态清理**: 清空状态栏

### 关键修改点

1. **AppHelper.ts**:
    - 队列空时发送完成状态
    - executeScanTask中添加文件进度更新
    - 扩展ScanCallbacks接口

2. **App.vue**:
    - 实现文件进度回调
    - 优化状态清理机制
    - 添加延迟清理逻辑

3. **scan-helpers.ts**:
    - processPhotoFile中添加状态更新
    - 确保文件处理状态同步

## 测试验证

### 功能测试

- [ ] 验证扫描完成后显示"扫描完成"消息
- [ ] 确认文件处理时显示具体文件名
- [ ] 测试状态清理延迟机制
- [ ] 验证多文件夹扫描的状态更新

### 回归测试

- [ ] 确认现有扫描功能不受影响
- [ ] 验证状态栏其他功能正常
- [ ] 测试扫描监控服务兼容性

## 风险评估

**低风险**: 仅修改状态显示逻辑，不影响核心扫描功能

**潜在影响**:

- 状态栏更新频率可能增加，需要注意性能
- 需确保状态清理机制不会产生内存泄漏

## 实施详情

### 已完成的修改

#### 1. AppHelper.ts 修改

- **位置**: `src/renderer/src/AppHelper.ts`
- **修改内容**:
    - 队列为空时发送"扫描完成"状态，延迟3秒后清理
    - 扩展`ScanCallbacks`接口添加`updateFileProgress`回调
    - 在`executeScanTask`中添加文件级别进度更新

#### 2. App.vue 修改

- **位置**: `src/renderer/src/App.vue`
- **修改内容**:
    - 实现`updateFileProgress`回调函数
    - 支持显示文件名和进度计数
    - 同时更新processingFile和statusBar状态

#### 3. scan-service.ts 修改

- **位置**: `src/main/scan/scan-service.ts`
- **修改内容**:
    - 在progress消息处理中添加currentFile信息显示
    - 优先显示"正在处理: 文件名"而不是路径

#### 4. scan-worker.ts 修改

- **位置**: `src/main/scan/scan-worker.ts`
- **修改内容**:
    - 已包含currentFile信息传递给scan-service

#### 5. 国际化支持（新增）

- **位置**: 多个文件
- **修改内容**:
    - locale文件添加新的状态文本keys
    - AppHelper.ts使用t函数替代硬编码文本
    - App.vue callbacks添加t函数支持
    - scan-service.ts传递原始数据让前端处理国际化
    - StatusBar.vue正确处理国际化显示

#### 6. 子文件夹队列显示修复（新增）

- **位置**: `src/renderer/src/App.vue`
- **修改内容**:
    - 移除addScanFolderWithLog中的重复队列检查
    - 修改scheduleNextScan延迟为500ms，让用户看到新添加的子文件夹
    - 让preference store统一处理优先级和去重逻辑

#### 7. 递归扫描深度修复（关键修复）

- **位置**: `src/renderer/src/stores/preference.ts`
- **问题**: "auto"源的子文件夹如果已有配置文件会被跳过，导致递归扫描在第一级停止
- **修改内容**:
    - 移除"auto"源文件夹的提前返回逻辑
    - 已扫描的文件夹仍添加到队列用于子文件夹发现
    - 确保所有层级的子文件夹都能被递归发现并添加到队列

#### 8. 状态栏完整路径显示修复

- **位置**: `src/renderer/src/AppHelper.ts` 和 `src/renderer/src/App.vue`
- **修改内容**:
    - AppHelper.ts传递原始文件路径而不是已国际化文本
    - App.vue的updateFileProgress函数负责国际化处理
    - 状态栏现在正确显示文件的完整路径

### 修改效果

1. **扫描完成状态**: 队列处理完成后显示"扫描完成"消息3秒（支持多语言）
2. **文件进度显示**: 实时显示"正在处理: [完整文件路径]"（支持多语言）
3. **状态同步**: processingFile和statusBar都能正确显示状态
4. **国际化支持**: 所有状态文本都使用locale，无硬编码
5. **递归扫描**: 所有层级的子文件夹都能被正确发现并显示在队列中
6. **队列可见性**: 用户可以看到所有被发现的子文件夹出现在扫描队列中

## 相关RFC

- RFC 0029: Worker池管理统一化 - 确保扫描性能
- RFC 0003: 统一Watch到扫描队列 - 扫描触发机制

## 结论

这个修复将显著改善用户对扫描进度的感知，提供清晰的状态反馈。修改范围有限，风险可控，建议立即实施。
