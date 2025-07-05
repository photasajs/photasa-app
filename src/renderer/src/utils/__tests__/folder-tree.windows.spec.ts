import { buildDataNode, cleanDataNode } from "../folder-tree";
import type { DataNode } from "ant-design-vue/es/tree";
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
    (globalThis as any).window = Object.assign(globalThis.window || {}, {
        api: {
            splitPath: (path: string) => path.split("\\").filter(Boolean),
            mergePath: (left: string, right: string) => left + (right ? "\\" + right : ""),
            getSeparator: () => "\\",
            normalizePath: (path: string) => path,
            toFileName: (path: string) => path.split("\\").pop() ?? "",
            toDirName: (path: string) => path.split("\\").slice(0, -1).join("\\"),
            isFileUnderFolder: (file: string, folder: string) => file.startsWith(folder),
            isHiddenFile: (path: string) => path.startsWith("."),
            isAbsolutePath: (path: string) => path.includes(":\\"),
            relativePath: (from: string, to: string) => to.replace(from, ""),
            resolvePath: (...segments: string[]) => segments.join("\\"),
            getRoot: (path: string) => path.split("\\")[0] || "",
        },
    });
});

describe("Folder Tree (Windows)", () => {
    it("should add root node with windows path", () => {
        const roots: DataNode[] = [];
        buildDataNode(roots, { path: "C:\\photos", thumbnail: "", isVideo: false });
        expect(roots).toMatchSnapshot();
    });

    it("should add deep nested nodes with windows path", () => {
        const roots: DataNode[] = [];
        buildDataNode(roots, { path: "C:\\photos", thumbnail: "", isVideo: false });
        buildDataNode(roots, { path: "C:\\photos\\2024", thumbnail: "", isVideo: false });
        buildDataNode(roots, { path: "C:\\photos\\2024\\01", thumbnail: "", isVideo: false });
        expect(roots).toMatchSnapshot();
    });

    it("should not add child if root does not exist (windows)", () => {
        const roots: DataNode[] = [];
        buildDataNode(roots, { path: "C:\\photos\\2024", thumbnail: "", isVideo: false });
        expect(roots).toMatchSnapshot();
    });

    it("should clean node at various levels (windows)", () => {
        const roots: DataNode[] = [];
        buildDataNode(roots, { path: "C:\\photos", thumbnail: "", isVideo: false });
        buildDataNode(roots, { path: "C:\\photos\\2024", thumbnail: "", isVideo: false });
        buildDataNode(roots, { path: "C:\\photos\\2024\\01", thumbnail: "", isVideo: false });
        cleanDataNode(roots, { path: "C:\\photos\\2024", thumbnail: "", isVideo: false });
        expect(roots).toMatchSnapshot();
    });

    it("should clean deep nested children recursively (windows)", () => {
        const roots: DataNode[] = [];
        buildDataNode(roots, { path: "C:\\photos", thumbnail: "", isVideo: false });
        buildDataNode(roots, { path: "C:\\photos\\2024", thumbnail: "", isVideo: false });
        buildDataNode(roots, { path: "C:\\photos\\2024\\01", thumbnail: "", isVideo: false });
        cleanDataNode(roots, { path: "C:\\photos\\2024\\01", thumbnail: "", isVideo: false });
        expect(roots).toMatchSnapshot();
    });
});
