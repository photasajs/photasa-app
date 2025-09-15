# RFC 0021: Playwright E2E Testing Architecture Enhancement

- **Start Date**: 2025-09-15
- **RFC PR**: (leave this empty)
- **Implementation Issue**: (leave this empty)

## Summary

Enhancement of the existing Playwright-based E2E testing infrastructure to provide comprehensive, maintainable, and scalable testing coverage for the Electron-based Photasa application.

## Motivation

The current E2E testing setup using Playwright is minimal and lacks the robust architecture needed for comprehensive testing of a complex Electron photo management application. We need:

1. **Comprehensive Coverage**: Test critical user journeys including photo import, management, and viewing workflows
2. **Maintainable Architecture**: Page Object Model and reusable test fixtures to reduce maintenance overhead
3. **CI/CD Integration**: Automated testing across multiple platforms (Windows, macOS, Linux)
4. **Developer Experience**: Clear testing patterns and debugging tools for the development team
5. **Quality Assurance**: Reliable detection of regressions in core functionality

The expected outcome is a production-ready E2E testing system that ensures application stability and enables confident releases.

## Detailed Design

### Architecture Overview

```
src/e2e/
├── fixtures/              # 测试固件和辅助工具
│   ├── electron-app.ts    # Electron 应用启动和管理
│   ├── test-data.ts       # 测试数据管理
│   └── database.ts        # 数据库测试工具
├── pages/                 # 页面对象模型 (POM)
│   ├── base-page.ts       # 基础页面类
│   ├── main-page.ts       # 主界面页面对象
│   ├── import-wizard-page.ts  # 导入向导页面对象
│   ├── settings-page.ts   # 设置页面对象
│   └── photo-viewer-page.ts  # 照片查看器页面对象
├── tests/                 # 测试用例
│   ├── app-lifecycle/     # 应用生命周期测试
│   ├── photo-import/      # 照片导入测试
│   ├── photo-management/  # 照片管理测试
│   ├── settings/          # 设置功能测试
│   └── performance/       # 性能测试
├── utils/                 # 工具函数
│   ├── helpers.ts         # 通用测试辅助函数
│   ├── constants.ts       # 测试常量
│   ├── file-utils.ts      # 文件操作工具
│   └── assertions.ts      # 自定义断言
└── test-data/             # 测试数据文件
    ├── sample-photos/     # 示例照片文件
    └── test-configs/      # 测试配置文件
```

### Core Components

#### 1. Electron App Fixture (`fixtures/electron-app.ts`)
```typescript
export class ElectronAppFixture {
  private app: ElectronApplication | null = null;
  private page: Page | null = null;

  async launch(options?: LaunchOptions): Promise<Page> {
    // 启动 Electron 应用
    // 管理多窗口场景
    // 提供应用状态检查方法
  }

  async cleanup(): Promise<void> {
    // 清理应用状态
    // 关闭所有窗口
    // 重置数据库状态
  }
}
```

#### 2. Base Page Object (`pages/base-page.ts`)
```typescript
export abstract class BasePage {
  protected page: Page;
  protected app: ElectronApplication;

  // 通用页面交互方法
  // 等待和断言工具
  // 截图和调试工具
}
```

#### 3. Test Configuration Enhancement
```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    {
      name: 'electron-dev',
      use: { 
        ...electronConfig,
        // 开发环境配置
      }
    },
    {
      name: 'electron-prod',
      use: { 
        ...electronConfig,
        // 生产构建配置
      }
    }
  ],
  reporter: [
    ['html'],
    ['json'],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ]
});
```

### Key Testing Scenarios

1. **Application Lifecycle**
   - 应用启动和初始化
   - 窗口管理（最小化、最大化、关闭）
   - 应用退出和数据持久化

2. **Photo Import Workflow**
   - 文件夹选择和扫描
   - 批量照片导入
   - 导入进度和错误处理
   - EXIF 数据提取验证

3. **Photo Management**
   - 照片浏览和导航
   - 照片搜索和过滤
   - 照片组织和标签
   - 照片删除和恢复

4. **Settings Management**
   - 设置更改和持久化
   - 主题切换
   - 语言切换
   - 存储路径配置

## Drawbacks

1. **Increased Maintenance**: 更多的测试代码需要维护
2. **CI/CD Complexity**: 跨平台测试增加 CI/CD 复杂性
3. **Test Execution Time**: 完整的 E2E 测试套件会增加构建时间
4. **Resource Usage**: Electron 应用测试需要更多系统资源
5. **Test Data Management**: 需要管理测试用的照片和数据文件

## Alternatives

### 1. WebdriverIO + wdio-electron-service
- **优点**: 成熟的测试生态系统
- **缺点**: 社区维护的 Electron 支持，文档较少

### 2. Cypress + cypress-electron-plugin  
- **优点**: 优秀的开发体验和调试工具
- **缺点**: Electron 支持有限，主要关注渲染进程

### 3. 保持现状（最小化 Playwright 设置）
- **影响**: 无法提供足够的测试覆盖，增加发布风险

### 4. 仅依赖单元测试
- **影响**: 无法测试用户完整工作流程，集成问题难以发现

## Implementation Plan

### Phase 1: 核心架构建立 (2 weeks)
- [ ] 增强 `playwright.config.ts` 配置
- [ ] 创建 `ElectronAppFixture` 基础设施
- [ ] 实现 `BasePage` 和核心页面对象
- [ ] 建立测试数据管理系统
- [ ] 重构现有测试用例

### Phase 2: 核心功能测试 (3 weeks)
- [ ] 实现应用生命周期测试
- [ ] 创建照片导入工作流测试
- [ ] 开发照片管理功能测试
- [ ] 添加设置管理测试
- [ ] 集成错误处理和边缘案例测试

### Phase 3: CI/CD 集成和优化 (1 week)
- [ ] 配置 GitHub Actions 跨平台测试
- [ ] 添加测试报告和结果上传
- [ ] 实现测试失败时的截图和视频保存
- [ ] 优化测试执行性能
- [ ] 建立测试维护文档

## Success Metrics

- **测试覆盖率**: 核心用户工作流 100% 覆盖
- **测试稳定性**: 测试通过率 > 95%
- **执行效率**: E2E 测试套件执行时间 < 15 分钟
- **跨平台兼容性**: Windows、macOS、Linux 三平台测试通过
- **CI/CD 集成**: 100% 的 PR 都运行 E2E 测试
- **缺陷检测**: 在发布前检测 > 90% 的关键功能缺陷

## Unresolved Questions

1. **测试数据策略**: 如何管理大量测试照片文件而不影响仓库大小？
2. **并行测试执行**: 如何在不同操作系统上并行运行测试而避免冲突？
3. **测试环境隔离**: 如何确保测试不会影响开发环境的数据？
4. **性能测试基准**: 应该设定什么样的性能基准来验证应用响应性？

## Future Possibilities

1. **视觉回归测试**: 集成 Playwright 的视觉比较功能
2. **API 测试**: 扩展测试覆盖到 Electron 主进程 API
3. **性能监控**: 集成性能指标收集和回归检测
4. **移动端支持**: 为可能的移动版本预留测试架构
5. **自动化测试生成**: 基于用户操作录制自动生成测试用例

## Conclusion

这个 RFC 提出了一个全面的 Playwright E2E 测试架构增强方案，能够：

- 提供可靠的测试覆盖来保证应用质量
- 建立可维护的测试架构以支持长期开发
- 集成到 CI/CD 流程中实现自动化质量保证
- 为团队提供清晰的测试开发指导

虽然会增加一些维护成本和 CI/CD 复杂性，但这些投资能够显著提高应用稳定性，减少生产环境问题，并提升团队开发效率。建议批准此 RFC 并按计划实施。

---

**Status**: Draft
**Assignee**: Development Team
**Reviewers**: Tech Lead, QA Team
**Target Release**: v1.7.0
