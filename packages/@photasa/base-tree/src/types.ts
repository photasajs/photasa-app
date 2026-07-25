/** Tree node key used by {@link BaseTree}. */
export type Key = string | number;

/** Nested tree node shape consumed by {@link BaseTree}. */
export interface TreeNode {
    key: Key;
    title: string;
    children?: TreeNode[];
    isLeaf?: boolean;
    disabled?: boolean;
    selectable?: boolean;
    checkable?: boolean;
    disableCheckbox?: boolean;
    icon?: unknown;
    [key: string]: unknown;
}

/** Flattened row rendered by virtual {@link BaseTree}. */
export interface VirtualTreeNode {
    key: Key;
    title: string;
    level: number;
    isVisible: boolean;
    hasChildren: boolean;
    isExpanded: boolean;
    originalNode: TreeNode;
}

export interface CheckedKeys {
    checked: Key[];
    halfChecked: Key[];
}

export interface ExpandInfo {
    node: TreeNode;
    expanded: boolean;
    nativeEvent: Event;
}

export interface SelectInfo {
    event: "select";
    selected: boolean;
    node: TreeNode;
    selectedNodes: TreeNode[];
    nativeEvent: Event;
}

export interface CheckInfo {
    event: "check";
    node: TreeNode;
    checked: boolean;
    nativeEvent: Event;
    checkedNodes: TreeNode[];
    checkedNodesPositions?: unknown[];
    halfCheckedKeys: Key[];
}
