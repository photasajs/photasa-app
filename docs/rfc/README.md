# RFCs (Request for Comments)

This directory contains RFCs for significant changes to the photo management application. RFCs help us track, discuss, and document major features and architectural decisions.

## RFC Statistics

- **Total RFCs**: 43
- **Completed**: 21 (48.8%)
- **In Progress**: 1 (2.3%)
- **Draft**: 21 (48.8%)
- **Rejected**: 0 (0%)

### By Version
- **v2.0.0**: 43 RFCs
- **Future**: 0 RFCs

## RFC Process

### 1. Creation

- Create a new RFC file: `NNNN-feature-name.md`
- Use the next available RFC number
- Follow the RFC template structure
- Submit as a pull request for review

### 2. Review Process

- **Draft**: Initial RFC creation and internal review
- **Under Review**: Community and team review period (1-2 weeks)
- **Accepted**: RFC approved for implementation
- **Implemented**: Feature has been implemented
- **Rejected**: RFC was not accepted (with reasons)

### 3. Implementation Tracking

- Link RFC to implementation issues/PRs
- Update status as implementation progresses
- Document any deviations from the original RFC

## RFC Template

```markdown
# RFC NNNN: Feature Name

- **Start Date**: YYYY-MM-DD
- **RFC PR**: (leave this empty)
- **Implementation Issue**: (leave this empty)

## Summary

Brief explanation of the feature.

## Motivation

Why are we doing this? What use cases does it support? What is the expected outcome?

## Detailed Design

This is the bulk of the RFC. Explain the design in enough detail for somebody familiar with the framework to understand, and for somebody familiar with the implementation to implement.

## Drawbacks

Why should we _not_ do this?

## Alternatives

What other designs have been considered? What is the impact of not doing this?

## Unresolved Questions

What parts of the design do you expect to resolve through the RFC process before this gets merged?
```

## Active RFCs

| RFC                                                               | Title                                           | Status              | Author | Target Release |
| ----------------------------------------------------------------- | ----------------------------------------------- | ------------------- | ------ | -------------- |
| [0004](./0004-ai-file-preview-service.md)                         | AI文件在线预览服务                              | Draft               | 李鹏   | v2.0.0         |
| [0008](./0008-scan-strategy-optimization.md)                      | 扫描策略优化                                    | Draft               | 李鹏   | v2.0.0         |
| [0010](./0010-folder-statistics-display.md)                       | 文件夹树节点统计信息显示                        | Draft               | 李鹏   | v2.0.0         |
| [0012](./0012-unified-path-handling-architecture.md)              | 统一路径处理架构重构                            | Draft               | 李鹏   | v2.0.0         |
| [0014](./0014-file-scan-folder-tree-update.md)                    | 文件扫描时文件夹树更新优化                      | Draft               | 李鹏   | v2.0.0         |
| [0018](./0018-scanning-folder-priority-sorting.md)                | 扫描文件夹优先级排序优化                        | Draft               | 李鹏   | v2.0.0         |
| [0020](./0020-auto-update-server.md)                              | Auto-Update System - Server Implementation      | Draft               | 李鹏   | v2.0.0         |
| [0021](./0021-playwright-e2e-testing-architecture-enhancement.md) | Playwright E2E Testing Architecture Enhancement | Draft               | 李鹏   | v2.0.0         |
| [0022](./0022-test-stabilization-issues-and-solutions.md)         | Test Stabilization Issues and Solutions         | Draft               | 李鹏   | v2.0.0         |
| [0023](./0023-startup-performance-optimization.md)                | Startup Performance Optimization                | Draft               | 李鹏   | v2.0.0         |
| [0025](./0025-tree-auto-focus-on-expand.md)                       | 树组件自动聚焦展开优化                          | Draft               | 李鹏   | v2.0.0         |
| [0026](./0026-file-type-indicator.md)                             | 文件类型指示器                                  | Draft               | 李鹏   | v2.0.0         |
| [0028](./0028-ffmpeg-binary-packaging-fix.md)                     | FFmpeg Binary Packaging Fix                     | Draft               | 李鹏   | v2.0.0         |
| [0029](./0029-process-based-thumbnail-architecture.md)            | 基于进程的缩略图架构                            | Draft               | 李鹏   | v2.0.0         |
| [0029](./0029-scan-skip-strategy-completion-fix.md)               | 扫描跳过策略完成修复                            | Draft               | 李鹏   | v2.0.0         |
| [0032](./0032-qianliyan-scan-engine.md)                           | 千里眼扫描引擎 (含scan-service迁移)              | 🔨 In Progress      | 李鹏   | v2.0.0         |
| [0033](./0033-shunfenger-watch-engine.md)                         | 顺风耳监听引擎                                  | Draft               | 李鹏   | v2.0.0         |
| [0034](./0034-linglong-vision-engine.md)                          | 玲珑视觉引擎                                    | Draft               | 李鹏   | v2.0.0         |
| [0037](./0037-tianshu-yaml-workflow-dsl.md)                       | 天枢YAML工作流DSL                               | Draft               | 李鹏   | v2.0.0         |
| [0038](./completed/0038-preference-workflow-integration.md)       | 偏好设置工作流集成与Store边界统一                | ✅ Completed        | 李鹏   | v2.0.0         |
| [0039](./0039-tianshu-workflow-syntax-specification.md)           | 天枢工作流语法规范                              | Draft               | 李鹏   | v2.0.0         |
| [0042](./0042-scanning-folder-migration.md)                       | scanningFolder三步渐进式迁移                     | Draft               | AI     | v2.0.0         |
| [0043](./0043-useqinqiong-access-pattern.md)                      | useQinQiong()访问模式 - appState统一访问         | Draft               | AI     | v2.0.0         |

## Implemented RFCs

| RFC                                                                                      | Title                                          | Author | Implemented In | Notes                                                                                      |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------- | ------ | -------------- | ------------------------------------------------------------------------------------------ |
| [0001](./completed/0001-import-wizard-system.md)                                         | Import Wizard System                           | 李鹏   | v2.0.0         | Complete import wizard with multi-step flow                                                |
| [0002](./completed/0002-headless-ui-components.md)                                       | Headless UI Components for Picasa Vue          | 李鹏   | v2.0.0         | 48 BaseUI components implemented, Ant Design fully removed, ~2.25MB bundle size reduction  |
| [0003](./completed/0003-unify-watch-to-scan-queue.md)                                    | Unify File Watch Events to Scan Queue          | 李鹏   | v2.0.0         | Persistent file operation queue with event deduplication                                   |
| [0005](./completed/0005-local-ai-file-preview.md)                                        | 本地AI文件预览功能                              | 李鹏   | v2.0.0         | 支持AI、PSD等设计文件的本地预览功能                                                        |
| [0006](./completed/0006-photo-detail-drawer-decoupling.md)                               | Photo Detail Drawer Decoupling from Ant Design | 李鹏   | v2.0.0         | Successfully replaced Ant Design drawer with custom BaseDrawer component                   |
| [0007](./completed/0007-folder-scan-cache-optimization.md)                               | Folder Scan Cache Optimization                 | 李鹏   | v2.0.0         | Intelligent incremental scanning and cleanup mechanisms                                    |
| [0009](./completed/0009-video-thumbnail-orientation.md)                                  | Video Thumbnail Orientation Support            | 李鹏   | v2.0.0         | Enhanced video thumbnail generation with rotation metadata support                         |
| [0011](./completed/0011-imagelist-file-count-display.md)                                 | ImageList File Count Display                   | 李鹏   | v2.0.0         | 在ImageList头部显示图片和视频文件计数，支持大数字格式化和响应式设计                        |
| [0013](./completed/0013-default-folder-selection.md)                                     | 默认文件夹选择功能                              | 李鹏   | v2.0.0         | 应用启动时自动选择默认文件夹，重启后恢复用户上次选择的文件夹                               |
| [0015](./completed/0015-intelligent-scan-optimization.md)                                | 验证智能扫描策略的子文件夹发现功能              | 李鹏   | v2.0.0         | 验证并修复智能扫描策略，确认子文件夹发现功能正常工作                                       |
| [0016](./completed/0016-basetree-component-implementation.md)                            | BaseTree Component Implementation               | 李鹏   | v2.0.0         | 实现BaseTree组件替代ant-design-vue的a-tree，支持虚拟滚动和100% API兼容性                  |
| [0017](./completed/0017-production-log-viewer.md)                                        | Production Log Viewer System                   | 李鹏   | v2.0.0         | 按需激活的生产环境日志查看器，零性能影响，支持主进程和Worker线程日志实时显示               |
| [0019](./completed/0019-auto-update-system.md)                                           | Auto-Update System - Client Implementation     | 李鹏   | v2.0.0         | 客户端自动更新系统实现，采用electron-updater方案，支持安全的preload集成                    |
| [0024](./completed/0024-log-viewer-resizable-panel.md)                                   | 日志查看器可调整大小面板增强                    | 李鹏   | v2.0.0         | 为日志查看器添加可调整大小面板功能，提升可用性和改善日志内容可见性                         |
| [0027](./completed/0027-wasm-memory-management-optimization.md)                          | WASM内存管理优化与HEIF解码错误处理              | 李鹏   | v2.0.0         | 优化WASM HEIF解码器内存管理机制，增强错误处理，提升大型HEIF图像处理稳定性                  |
| [0030](./completed/0030-scan-status-reporting-fix.md)                                    | 扫描状态报告修复                                | 李鹏   | v2.0.0         | 修复扫描过程中的状态报告问题，确保UI状态栏正确显示扫描进度和完成状态                       |
| [0031](./completed/0031-maliang-image-processing-engine.md)                              | Ma-Liang 统一图像处理引擎                       | 李鹏   | v2.0.0         | 创建统一图像处理引擎，整合FFmpeg、Sharp、WASM-HEIF和Photon库，支持BMP和MPEG/MPG格式      |
| [0035](./completed/0035-five-engine-orchestration-architecture.md)                      | 天枢·顺风耳·千里眼·司簿·马良五引擎编排架构      | 李鹏   | v2.0.0         | 建立五大核心引擎协同系统，通过太乙服务层桥接和YAML工作流元数据驱动，实现完整链路           |
| [0036](./completed/0036-wenchang-preference-integration.md)                              | 偏好设置启动加载和保存机制                      | 李鹏   | v2.0.0         | 完整的偏好设置双向通信机制，启动加载、智能合并、实时保存，391测试通过                      |
| [0040](./completed/0040-removepath-functionality-fix.md)                                 | RemovePath功能修复 - 天界人界数据同步完整实现   | 李鹏   | v2.0.0         | 天界人界数据同步完整实现，修复UI更新问题，后续被RFC 0041进一步优化                         |
| [0041](./completed/0041-preference-architecture-refactor-business-logic-separation.md)   | 偏好架构重构 - 业务逻辑与存储层分离             | 李鹏   | v2.0.0         | 应用Linus"好品味"原则，业务逻辑从WenchangEngine分离到FangXuanLing，架构更清晰易维护        |

## Rejected RFCs

| RFC | Title | Rejection Reason | Date |
| --- | ----- | ---------------- | ---- |
| -   | -     | -                | -    |

## RFC Guidelines

### When to Write an RFC

Write an RFC for:

- **Major Features**: Significant new functionality
- **Breaking Changes**: Changes that affect existing APIs or user workflows
- **Architecture Changes**: Modifications to core system architecture
- **Performance Changes**: Major performance optimizations or trade-offs
- **Security Changes**: Security-related modifications

### When NOT to Write an RFC

Don't write an RFC for:

- **Bug Fixes**: Simple bug fixes and patches
- **Minor Features**: Small, self-contained features
- **Documentation**: Documentation updates and improvements
- **Refactoring**: Internal code improvements without user impact
- **Dependencies**: Adding or updating dependencies

### RFC Quality Guidelines

A good RFC should:

- **Be Clear**: Use simple, precise language
- **Be Complete**: Cover all aspects of the proposed change
- **Be Realistic**: Propose implementable solutions
- **Consider Alternatives**: Discuss other approaches
- **Address Concerns**: Anticipate and address potential issues
- **Include Examples**: Provide concrete usage examples
- **Define Success**: Include measurable success criteria

### Review Criteria

RFCs are evaluated on:

- **Technical Merit**: Is the solution technically sound?
- **User Value**: Does it provide clear value to users?
- **Implementation Feasibility**: Can it be reasonably implemented?
- **Maintenance Impact**: What is the long-term maintenance cost?
- **Compatibility**: Does it maintain backward compatibility?
- **Documentation**: Is it well-documented and explained?

## RFC Lifecycle

```
Draft → Under Review → Accepted → Implementation → Implemented
  ↓                      ↓
Withdrawn            Rejected
```

### Status Definitions

- **Draft**: RFC is being written and refined
- **Under Review**: RFC is open for community review
- **Accepted**: RFC has been approved for implementation
- **Implementation**: RFC is being implemented
- **Implemented**: RFC has been fully implemented
- **Rejected**: RFC was not accepted (with documented reasons)
- **Withdrawn**: RFC was withdrawn by the author

## Contributing

### For RFC Authors

1. **Research**: Review existing RFCs and codebase
2. **Discuss**: Have informal discussions before writing
3. **Write**: Follow the RFC template
4. **Submit**: Create a pull request
5. **Iterate**: Respond to feedback and update the RFC
6. **Implement**: Lead or coordinate implementation

### For Reviewers

1. **Read Carefully**: Understand the full proposal
2. **Ask Questions**: Clarify unclear aspects
3. **Provide Feedback**: Offer constructive criticism
4. **Consider Impact**: Think about long-term implications
5. **Be Respectful**: Maintain professional discourse

## Tools and Automation

### RFC Validation

We use automated tools to validate RFCs:

- **Markdown Linting**: Ensure proper formatting
- **Link Checking**: Verify all links work
- **Template Compliance**: Check RFC follows template

### Status Tracking

RFC status is tracked through:

- **GitHub Labels**: Applied to RFC pull requests
- **Project Boards**: Visual tracking of RFC progress
- **Automated Updates**: Status updates from implementation PRs

## Historical Context

This RFC process was established to:

- Improve decision-making transparency
- Reduce implementation rework
- Better coordinate team efforts
- Document architectural decisions
- Enable community participation

The process is inspired by:

- [Rust RFC Process](https://github.com/rust-lang/rfcs)
- [Vue RFC Process](https://github.com/vuejs/rfcs)
- [React RFC Process](https://github.com/reactjs/rfcs)
