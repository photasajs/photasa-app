/**
 * UI组件库导出文件
 * 为Vue和桌面应用专门设计的Headless UI组件库
 *
 * @description
 * 这是一个专为Vue 3和桌面应用优化的UI组件库，采用Headless UI设计理念：
 * - 无样式依赖：组件只提供逻辑和行为，样式完全由TailwindCSS控制
 * - Vue原生：充分利用Vue 3特性，无第三方适配层
 * - Portal友好：天然支持Vue Teleport，无事件冲突
 * - 桌面优化：专为Electron等桌面应用设计，无移动端负担
 * - 组件化：每个组件单一职责，可组合使用
 *
 * @see RFC文档: /docs/rfcs/headless-ui-components.md
 * @version 1.0.0
 * @author Picasa Vue Team
 */

// === 核心基础组件 ===
export { default as BaseButton } from "./BaseButton.vue";
export { default as BaseInput } from "./BaseInput.vue";
export { default as BaseCheckbox } from "./BaseCheckbox.vue";
export { default as BaseSwitch } from "./BaseSwitch.vue";

// === 表单组件 ===
export { default as BaseForm } from "./BaseForm.vue";
export { default as BaseFormField } from "./BaseFormField.vue";

// === 选择器组件 ===
export { default as BaseSelect } from "./BaseSelect.vue";
export { default as BaseRadio } from "./BaseRadio.vue";
export { default as BaseRadioGroup } from "./BaseRadioGroup.vue";

// === Modal组件系统 (Headless + TailwindCSS) ===
// 根容器 - 处理Portal、焦点管理、键盘事件
export { default as BaseModal } from "./BaseModal.vue";
// 背景遮罩 - 完全自定义样式
export { default as BaseModalOverlay } from "./BaseModalOverlay.vue";
// 内容容器 - 主要内容区域
export { default as BaseModalContainer } from "./BaseModalContainer.vue";
// 标题区域 - 支持props和slots
export { default as BaseModalHeader } from "./BaseModalHeader.vue";
export { default as BaseModalTitle } from "./BaseModalTitle.vue";
// 内容和底部区域
export { default as BaseModalBody } from "./BaseModalBody.vue";
export { default as BaseModalFooter } from "./BaseModalFooter.vue";
// 关闭按钮 - 可选图标和自定义样式
export { default as BaseModalCloseButton } from "./BaseModalCloseButton.vue";

// === 下拉菜单组件 ===
export { default as BaseDropdown } from "./BaseDropdown.vue";
export { default as BaseDropdownItem } from "./BaseDropdownItem.vue";
export { default as BaseContextMenu } from "./BaseContextMenu.vue";
export { default as BaseMenuItem } from "./BaseMenuItem.vue";

// === 布局和导航 ===
export { default as BaseTabs } from "./BaseTabs.vue";
export { default as BaseCard } from "./BaseCard.vue";

// === 反馈和加载组件 ===
export { default as BaseAlert } from "./BaseAlert.vue";
export { default as BaseSpinner } from "./BaseSpinner.vue";
export { default as BaseSpinContainer } from "./BaseSpinContainer.vue";
export { default as BaseNotification } from "./BaseNotification.vue";
export { default as NotificationContainer } from "./NotificationContainer.vue";

// === 展示和描述组件 ===
export { default as BaseDescriptions } from "./BaseDescriptions.vue";
export { default as BaseDescriptionItem } from "./BaseDescriptionItem.vue";
export { default as BaseDrawer } from "./BaseDrawer.vue";
export { default as BaseBreadcrumb } from "./BaseBreadcrumb.vue";
export { default as BaseBreadcrumbItem } from "./BaseBreadcrumbItem.vue";
export { default as BaseTooltip } from "./BaseTooltip.vue";

// === 图片和虚拟化 ===
export { default as BaseImage } from "./BaseImage.vue";
export { default as VirtualizedGrid } from "./VirtualizedGrid.vue";
export { default as VirtualList } from "./VirtualList.vue";

// === 树形组件 ===
export { default as BaseTree } from "./BaseTree.vue";
export { default as BaseTreeNode } from "./BaseTreeNode.vue";

// === 布局组件 ===
export { default as BaseRow } from "./BaseRow.vue";
export { default as BaseCol } from "./BaseCol.vue";
export { default as BaseSpace } from "./BaseSpace.vue";

// === 数据展示组件 ===
export { default as BaseProgress } from "./BaseProgress.vue";
export { default as BaseStatistic } from "./BaseStatistic.vue";
export { default as BaseTag } from "./BaseTag.vue";
export { default as BaseBadge } from "./BaseBadge.vue";
export { default as BaseList } from "./BaseList.vue";
export { default as BaseListItem } from "./BaseListItem.vue";
export { default as BaseAccordion } from "./BaseAccordion.vue";
export { default as BaseAccordionPanel } from "./BaseAccordionPanel.vue";

// === Portal系统 ===
// 为Teleport提供渲染目标，与Vue原生兼容
export { default as PortalProvider } from "./PortalProvider.vue";
