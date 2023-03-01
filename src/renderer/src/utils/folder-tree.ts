import type { DataNode } from "ant-design-vue/es/tree";

export function buildDataNode(roots: DataNode[], path: string): void {
    const pathParts = path.split("/").filter((part) => part !== "");

    if (pathParts.length === 1) {
        roots.push({
            key: pathParts[0],
            title: pathParts[0],
            children: [],
        });
        return;
    }
    let root = roots.find((node) => node.key === pathParts[0]);
    if (!root) {
        root = {
            key: pathParts[0],
            title: pathParts[0],
            children: [],
        };
        roots.push(root);
    }

    traverseTree(root, pathParts.slice(1), path);
}

function traverseTree(root: DataNode, pathParts: string[], path: string): DataNode {
    if (pathParts.length <= 1) {
        root.children?.push({
            key: pathParts[0],
            title: path,
            isLeaf: true,
        });
        return root;
    }

    let child = root.children?.find((node) => node.key === pathParts[0]);
    if (!child) {
        child = {
            key: pathParts[0],
            title: pathParts[0],
            children: [],
        };

        root.children?.push(child);

        return traverseTree(child, pathParts.slice(1), path);
    }

    return traverseTree(child, pathParts.slice(1), path);
}
