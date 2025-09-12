# 扫描修复功能测试

本目录包含扫描修复功能的测试用例，验证扫描系统能够正确跳过已扫描的文件夹。

## 测试文件说明

### 1. scan-fix-simple.test.ts

**简化测试** - 验证核心修复功能

- ✅ 测试 `decideScanStrategy` 函数在有有效 `.photasa.json` 时返回 SKIP 策略
- ✅ 测试配置文件不存在时返回 FULL 策略
- ✅ 测试强制重新扫描时返回 FULL 策略
- ✅ 测试配置文件为空时的处理逻辑
- ✅ 验证不再依赖 `.photasa-folder.json` 进行决策

### 2. scan-strategy-fix.test.ts

**策略决策测试** - 详细测试 `decideScanStrategy` 函数

- 测试各种配置文件状态的处理
- 测试错误处理和边界情况
- 性能测试（大量照片的配置文件）

### 3. scan-helpers-fix.test.ts

**辅助函数测试** - 测试 `restoreCachedFiles` 函数

- 测试文件路径构建的正确性
- 测试各种配置文件格式的处理
- 测试错误恢复机制

### 4. check-photasa-config.test.ts

**IPC API 测试** - 测试新的检查配置文件 API

- 测试配置文件存在性检查
- 测试各种错误情况的处理
- 测试性能表现

### 5. preference-scan-fix.test.ts

**UI 层测试** - 测试 `addScanFolder` 的智能检查

- 测试已扫描文件夹的跳过逻辑
- 测试新文件夹的正常扫描
- 测试错误处理

### 6. scan-integration-fix.test.ts

**集成测试** - 测试完整的扫描流程

- 测试混合场景（部分已扫描，部分需要扫描）
- 测试性能表现
- 测试错误恢复

## 运行测试

```bash
# 运行所有扫描修复测试
npm test -- src/main/scan/__tests__/

# 运行简化测试（推荐）
npm test -- src/main/scan/__tests__/scan-fix-simple.test.ts

# 运行特定测试
npm test -- src/main/scan/__tests__/scan-strategy-fix.test.ts
```

## 测试覆盖的功能

### 核心修复

1. **策略决策优化** - `decideScanStrategy` 直接基于 `.photasa.json` 进行决策
2. **文件恢复修复** - `restoreCachedFiles` 正确处理文件名格式
3. **智能预检查** - `addScanFolder` 在添加队列前检查是否已扫描

### 错误处理

1. 配置文件不存在
2. 配置文件格式错误
3. 文件系统权限问题
4. 网络通信错误

### 性能优化

1. 大量已扫描文件夹的快速跳过
2. 大量照片配置文件的快速处理
3. 并发处理的性能表现

## 测试结果

所有测试都通过，验证了修复功能的正确性：

- ✅ 已扫描的文件夹会被智能跳过
- ✅ 未扫描的文件夹会正常扫描
- ✅ 错误情况得到正确处理
- ✅ 性能表现符合预期
- ✅ 不再依赖 `.photasa-folder.json` 进行决策

## 修复效果

通过这些测试验证，扫描修复功能实现了：

1. **智能跳过** - 已扫描的文件夹立即跳过，无需等待
2. **性能提升** - 避免不必要的文件系统遍历和缩略图生成
3. **用户体验** - 扫描时间大幅减少，响应更快速
4. **系统稳定** - 错误处理完善，不会因异常而崩溃
