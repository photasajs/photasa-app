import { buildDataNode } from "../folder-tree";

describe("buildDataNode", () => {
    it("should return a DataNode", () => {
        const roots = [];
        const path = "test/google.com/test.jpg";
        buildDataNode(roots, path);
        expect(roots).toMatchSnapshot();
    });

    it("should build path tree node with one path", () => {
        const roots = [];
        buildDataNode(roots, "/test/Goodbye/test.jpg");
        buildDataNode(roots, "/test/Goodbye/test2.jpg");
        expect(roots).toMatchSnapshot();
    });

    it("should build path tree node with multiple", () => {
        const roots = [];
        buildDataNode(roots, "/test/Goodbye/test.jpg");
        buildDataNode(roots, "/test/go/test2.jpg");
        expect(roots).toMatchSnapshot();
    });

    it("should build path tree node when root exist", () => {
        const roots = [
            {
                key: "/test",
                title: "test",
            },
        ];
        buildDataNode(roots, "/test/Goodbye/asas/test.jpg");
        buildDataNode(roots, "/test/go/sdks/test2.jpg");
        expect(roots).toMatchSnapshot();
    });

    it("should build path tree node without duplication", () => {
        const roots = [
            {
                key: "/Users/albert.li/Desktop",
                title: "/Uses/albert.li/Desktop",
            },
        ];
        buildDataNode(roots, "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/image0-15.jpg");
        buildDataNode(roots, "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/image1-1.jpg");
        buildDataNode(roots, "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/image1-1.jpg");
        buildDataNode(roots, "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/image1-2.jpg");
        expect(roots).toMatchSnapshot();
    });
});
