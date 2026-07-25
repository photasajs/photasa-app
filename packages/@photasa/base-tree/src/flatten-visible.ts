import type { Key, TreeNode, VirtualTreeNode } from "./types";

/**
 * Flatten expanded tree nodes for virtual scrolling.
 * Root nodes are always visible; descendants appear only when ancestors are expanded.
 */
export function flattenVisibleTreeNodes(
    nodes: TreeNode[],
    expandedKeys: Set<Key>,
    level = 0,
    parentExpanded = true,
): VirtualTreeNode[] {
    const result: VirtualTreeNode[] = [];

    for (const node of nodes) {
        const isExpanded = expandedKeys.has(node.key);
        const hasChildren = Boolean(node.children?.length) && !node.isLeaf;
        const isVisible = level === 0 ? true : parentExpanded;

        if (isVisible) {
            result.push({
                key: node.key,
                title: node.title,
                level,
                isVisible,
                hasChildren,
                isExpanded,
                originalNode: node,
            });
        }

        if (hasChildren && isExpanded && node.children) {
            result.push(
                ...flattenVisibleTreeNodes(node.children, expandedKeys, level + 1, isExpanded),
            );
        }
    }

    return result;
}

/** Drop duplicate keys while preserving first occurrence order. */
export function dedupeVisibleNodes(nodes: VirtualTreeNode[]): VirtualTreeNode[] {
    const seen = new Set<Key>();
    const uniqueNodes: VirtualTreeNode[] = [];

    for (const node of nodes) {
        if (!seen.has(node.key)) {
            seen.add(node.key);
            uniqueNodes.push(node);
        }
    }

    return uniqueNodes;
}

/** Collect every node key in depth-first order. */
export function extractAllTreeKeys(nodes: TreeNode[]): Key[] {
    const keys: Key[] = [];

    const traverse = (nodeList: TreeNode[]) => {
        for (const node of nodeList) {
            keys.push(node.key);
            if (node.children?.length) {
                traverse(node.children);
            }
        }
    };

    traverse(nodes);
    return keys;
}

/** Depth-first lookup by key. */
export function findTreeNode(key: Key, nodes: TreeNode[]): TreeNode | null {
    for (const node of nodes) {
        if (node.key === key) {
            return node;
        }
        if (node.children) {
            const found = findTreeNode(key, node.children);
            if (found) {
                return found;
            }
        }
    }
    return null;
}
