/**
 * ✅ RFC 0042 Step 2.5: 文件夹树节点类型
 * 共享类型，供Main进程（千里眼引擎）和Renderer进程（PreferenceStore）使用
 * 避免Main进程依赖Renderer类型
 */
export interface FolderNode {
    key: string | number;
    title: string;
    children?: FolderNode[];
    isLeaf?: boolean;
    disabled?: boolean;
    selectable?: boolean;
    checkable?: boolean;
    [key: string]: unknown;
}
