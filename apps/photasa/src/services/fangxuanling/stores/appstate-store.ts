import { defineStore } from "pinia";
import type { FolderNode } from "@photasa/common";

/**
 * 应用状态接口
 *
 * ✅ RFC 0042 Step 2.5: AppStateStore创建
 * 职责分离原则（Linus好品味）：
 * - preferences.ts - 只管理用户偏好设置（持久化配置）
 * - scanning.ts - 管理scanningFolder（已在Step 1完成）
 * - appstate.ts - 管理应用运行时状态（folderTree + currentFolder等）
 */
export interface AppState {
    /** 文件夹树结构（Step 2.5主要迁移内容） */
    folderTree: FolderNode[];
    /** 当前文件夹路径 */
    currentFolder: string;
    /** 最后打开的文件夹路径 */
    lastOpenedFolder: string;
}

/**
 * AppState Store（应用状态库）
 *
 * 职责：
 * - 管理文件夹树结构（folderTree）
 * - 提供folderTree访问接口
 * - 由天界千里眼负责持久化（~/.photasa/appstate/foldertree.json）
 *
 * 访问方式：
 * - ❌ 服务不得擅入典籍库（禁止直接访问Store）
 * - ✅ 必须通过房玄龄提供的访问器（经宰相批准后访问）
 *
 * @since RFC 0042 Step 2.5
 */
export const useAppStateStore = defineStore("appstate", {
    state: (): AppState => ({
        folderTree: [],
        currentFolder: "",
        lastOpenedFolder: "",
    }),

    getters: {
        /**
         * 获取文件夹树节点数量
         * 🏛️ 朝廷统计：文件夹树节点总数
         */
        nodeCount: (state) => {
            // 🔧 防御性编程：确保folderTree不为undefined或null
            const tree = state.folderTree;
            if (!tree || !Array.isArray(tree)) {
                return 0;
            }

            const countNodes = (nodes: FolderNode[]): number => {
                // 🔧 防御性编程：确保nodes不为undefined或null
                if (!nodes || !Array.isArray(nodes)) {
                    return 0;
                }

                let count = nodes.length;
                for (const node of nodes) {
                    if (node?.children) {
                        count += countNodes(node.children);
                    }
                }
                return count;
            };
            return countNodes(tree);
        },
    },
});

export type AppStateStore = ReturnType<typeof useAppStateStore>;
