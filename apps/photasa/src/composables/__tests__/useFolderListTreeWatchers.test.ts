import { defineComponent, h, nextTick, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FolderNode, PhotasaConfig } from "@photasa/common";
import { useFolderListTreeWatchers } from "../useFolderListTreeWatchers";
import type { UseFolderListTreeWatchersResult } from "../useFolderListTreeWatchers";

beforeAll(() => {
    (globalThis as Record<string, unknown>).window = Object.assign(globalThis.window || {}, {
        api: {
            mergePath: (left: string, right: string) => left + (right ? `/${right}` : ""),
        },
    });
});

const ROOT = "/photos";

function buildTree(extraChild?: FolderNode): FolderNode[] {
    return [
        {
            key: ROOT,
            title: "photos",
            children: [
                {
                    key: `${ROOT}/vacation`,
                    title: "vacation",
                    children: extraChild ? [extraChild] : [],
                },
            ],
        },
    ];
}

function createPreferenceStore(currentFolder = "") {
    return {
        appState: {
            currentFolder,
            currentFolderConfig: {
                version: "",
                photoList: [],
                lastModified: 0,
            } satisfies PhotasaConfig,
        },
    };
}

function mountWatchers(options: {
    folderTree?: FolderNode[];
    paths?: string[];
    currentFolder?: string;
}) {
    const folderTree = ref<FolderNode[]>(options.folderTree ?? []);
    const paths = ref(options.paths ?? [ROOT]);
    const currentFolder = ref(options.currentFolder ?? "");
    const preferenceStore = createPreferenceStore();
    const getFolderConfig = vi.fn().mockResolvedValue({
        version: "1",
        photoList: ["a.jpg"],
        lastModified: 1,
    });
    const weiZheng = { getFolderConfig };

    let watchers!: UseFolderListTreeWatchersResult;
    const Host = defineComponent({
        setup() {
            watchers = useFolderListTreeWatchers({
                folderTree,
                paths,
                currentFolder,
                preferenceStore: preferenceStore as never,
                weiZheng: weiZheng as never,
            });
            return () => h("div");
        },
    });

    const wrapper = mount(Host);

    return {
        wrapper,
        folderTree,
        paths,
        currentFolder,
        preferenceStore,
        getFolderConfig,
        get watchers() {
            return watchers;
        },
    };
}

describe("useFolderListTreeWatchers (RFC 0165)", () => {
    it("immediate sync expands ancestors and selects currentFolder on mount", async () => {
        const deepPath = `${ROOT}/vacation/2024`;
        const tree = buildTree({ key: deepPath, title: "2024", children: [] });

        const ctx = mountWatchers({
            folderTree: tree,
            currentFolder: deepPath,
        });

        await nextTick();

        expect(ctx.watchers.expandedKeys.value).toContain(ROOT);
        expect(ctx.watchers.expandedKeys.value).toContain(`${ROOT}/vacation`);
        expect(ctx.watchers.selectedKeys.value).toEqual([deepPath]);

        ctx.wrapper.unmount();
    });

    it("folderTree reconcile without new keys still merges expandedKeys for currentFolder", async () => {
        const deepPath = `${ROOT}/vacation/2024`;
        const tree = buildTree({ key: deepPath, title: "2024", children: [] });

        const ctx = mountWatchers({
            folderTree: tree,
            currentFolder: deepPath,
        });
        await nextTick();

        ctx.watchers.expandedKeys.value = [ROOT];

        ctx.folderTree.value = buildTree({ key: deepPath, title: "2024", children: [] });
        await nextTick();

        expect(ctx.watchers.expandedKeys.value).toContain(`${ROOT}/vacation`);

        ctx.wrapper.unmount();
    });

    it("does not scroll when folderTree updates after user expanded tree", async () => {
        const deepPath = `${ROOT}/vacation`;
        const scrollToNode = vi.fn();
        const ctx = mountWatchers({
            folderTree: buildTree(),
            currentFolder: deepPath,
        });

        ctx.watchers.folderTreeRef.value = { scrollToNode } as never;
        await nextTick();
        await flushPromises();

        ctx.watchers.onTreeExpand();
        scrollToNode.mockClear();

        ctx.folderTree.value = buildTree({
            key: `${ROOT}/vacation/2024`,
            title: "2024",
            children: [],
        });
        await nextTick();
        await flushPromises();

        expect(scrollToNode).not.toHaveBeenCalled();

        ctx.wrapper.unmount();
    });

    it("scrolls once when folderTree goes from empty to populated", async () => {
        const deepPath = `${ROOT}/vacation`;
        const scrollToNode = vi.fn();
        const ctx = mountWatchers({
            folderTree: [],
            currentFolder: deepPath,
        });

        ctx.watchers.folderTreeRef.value = { scrollToNode } as never;
        await nextTick();
        await flushPromises();
        expect(scrollToNode).not.toHaveBeenCalled();

        ctx.folderTree.value = buildTree();
        await nextTick();
        await flushPromises();

        expect(scrollToNode).toHaveBeenCalledTimes(1);
        expect(scrollToNode).toHaveBeenCalledWith(deepPath, {
            align: "center",
            behavior: "auto",
        });

        ctx.wrapper.unmount();
    });

    it("selectedKeys change writes currentFolder and loads folder config", async () => {
        const otherFolder = `${ROOT}/vacation`;
        const ctx = mountWatchers({
            folderTree: buildTree(),
            currentFolder: ROOT,
        });
        await nextTick();

        ctx.watchers.selectedKeys.value = [otherFolder];
        await flushPromises();

        expect(ctx.preferenceStore.appState.currentFolder).toBe(otherFolder);
        expect(ctx.getFolderConfig).toHaveBeenCalledWith(otherFolder);
        expect(ctx.preferenceStore.appState.currentFolderConfig).toEqual({
            version: "1",
            photoList: ["a.jpg"],
            lastModified: 1,
        });

        ctx.wrapper.unmount();
    });

    it("discovers new subtree keys and expands their ancestors", async () => {
        const ctx = mountWatchers({
            folderTree: [{ key: ROOT, title: "photos", children: [] }],
            currentFolder: ROOT,
        });
        await nextTick();

        ctx.folderTree.value = buildTree({
            key: `${ROOT}/vacation/2024`,
            title: "2024",
            children: [],
        });
        await nextTick();

        expect(ctx.watchers.expandedKeys.value).toContain(`${ROOT}/vacation`);

        ctx.wrapper.unmount();
    });
});
