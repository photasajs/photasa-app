# RFCs (Request for Comments)

This directory contains RFCs for significant changes to the photo management application. RFCs help us track, discuss, and document major features and architectural decisions.

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

| RFC                                             | Title                                      | Status              | Assignee         | Target Release |
| ----------------------------------------------- | ------------------------------------------ | ------------------- | ---------------- | -------------- |
| [0002](./0002-headless-ui-components.md)        | Headless UI Components for Picasa Vue      | Phase 2 In Progress | Development Team | v1.0.0         |
| [0004](./0004-ai-file-preview-service.md)       | AI文件在线预览服务                         | Draft               | Development Team | Future         |
| [0005](./0005-local-ai-file-preview.md)         | 本地AI文件预览功能                         | Draft               | Development Team | Future         |
| [0010](./0010-folder-statistics-display.md)     | 文件夹树节点统计信息显示                   | Draft               | Development Team | v1.6.0         |
| [0014](./0014-file-scan-folder-tree-update.md)  | 文件扫描时文件夹树更新优化                 | Draft               | Development Team | v1.6.0         |
| [0015](./0015-intelligent-scan-optimization.md) | 智能扫描优化策略修复                       | Draft               | Development Team | v1.6.0         |
| [0019](./0019-auto-update-system.md)            | Auto-Update System - Client Implementation | Draft               | Development Team | v1.6.0         |
| [0020](./0020-auto-update-server.md)            | Auto-Update System - Server Implementation | Draft               | Development Team | v1.6.0         |
| [0021](./0021-playwright-e2e-testing-architecture-enhancement.md) | Playwright E2E Testing Architecture Enhancement | Draft               | Development Team | v1.7.0         |
| [0022](./0022-test-stabilization-issues-and-solutions.md)        | Test Stabilization Issues and Solutions         | Implemented         | Development Team | v1.7.0         |
| [0023](./0023-startup-performance-optimization.md)               | Startup Performance Optimization                | Draft               | Development Team | v1.8.0         |

## Implemented RFCs

| RFC                                                  | Title                                          | Implemented In | Notes                                                                    |
| ---------------------------------------------------- | ---------------------------------------------- | -------------- | ------------------------------------------------------------------------ |
| [0001](./0001-import-wizard-system.md)               | Import Wizard System                           | v2.1.0         | Complete import wizard with multi-step flow                              |
| [0003](./0003-unify-watch-to-scan-queue.md)          | Unify File Watch Events to Scan Queue          | v1.0.0         | Persistent file operation queue with event deduplication                 |
| [0007](./0007-folder-scan-cache-optimization.md)     | Folder Scan Cache Optimization                 | v1.0.0         | Intelligent incremental scanning and cleanup mechanisms                  |
| [0006](./0006-photo-detail-drawer-decoupling.md)     | Photo Detail Drawer Decoupling from Ant Design | v1.6.0         | Successfully replaced Ant Design drawer with custom BaseDrawer component |
| [0008](./0008-scan-strategy-optimization.md)         | Scan Strategy Optimization                     | v1.6.0         | Smart scanning strategy with cache-based decision making                 |
| [0009](./0009-video-thumbnail-orientation.md)        | Video Thumbnail Orientation Support            | v1.6.0         | Enhanced video thumbnail generation with rotation metadata support       |
| [0012](./0012-unified-path-handling-architecture.md) | 统一路径处理架构重构                           | v1.6.0         | 统一路径处理逻辑，解决跨平台兼容性问题                                   |
| [0018](./0018-scanning-folder-priority-sorting.md)   | 扫描文件夹优先级排序优化                       | v1.7.0         | 实现基于优先级的扫描队列排序，支持用户操作优先于自动发现                 |

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
