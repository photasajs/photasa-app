import { buildDataNode, getFolderFiles, resetFileList } from "../folder-tree";

describe("Folder Tree", () => {
    beforeEach(() => {
        resetFileList();
    });

    it("should return a DataNode", () => {
        const roots = [];
        const path = "/test/google.com/test.jpg";
        buildDataNode(roots, path);
        expect({
            roots,
            fileList1: getFolderFiles("/test/"),
            fileList2: getFolderFiles("/test/google.com/"),
        }).toMatchSnapshot();
    });

    it("should build path tree node with one path", () => {
        const roots = [];
        buildDataNode(roots, "/test/Goodbye/test.jpg");
        buildDataNode(roots, "/test/Goodbye/test2.jpg");
        expect({
            roots,
            fileList1: getFolderFiles("/test"),
            fileList2: getFolderFiles("/test/Goodbye"),
        }).toMatchSnapshot();
    });

    it("should build path tree node with multiple", () => {
        const roots = [];
        buildDataNode(roots, "/test/Goodbye/test.jpg");
        buildDataNode(roots, "/test/go/test2.jpg");
        expect({
            roots,
            fileList1: getFolderFiles("test"),
            fileList2: getFolderFiles("/test/go"),
            fileList3: getFolderFiles("/test/Goodbye"),
        }).toMatchSnapshot();
    });

    it("should build path tree node when root exist", () => {
        const roots = [
            {
                key: "/test/",
                title: "test",
            },
        ];
        buildDataNode(roots, "/test/Goodbye/asas/test.jpg");
        buildDataNode(roots, "/test/go/sdks/test2.jpg");
        expect({
            roots,
            fileList1: getFolderFiles("test"),
            fileList2: getFolderFiles("test/Goodbye/asas"),
            fileList3: getFolderFiles("test/notexistpath/asas"),
        }).toMatchSnapshot();
    });

    it("should build path tree node without duplication", () => {
        const roots = [
            {
                key: "/Users/albert.li/Desktop/",
                title: "/Uses/albert.li/Desktop",
            },
        ];
        buildDataNode(roots, "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/image0-15.jpg");
        buildDataNode(roots, "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/image1-1.jpg");
        buildDataNode(roots, "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/image1-1.jpg");
        buildDataNode(roots, "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/image1-2.jpg");
        expect({
            roots,
            fileList1: getFolderFiles("/Users/albert.li/Desktop"),
            fileList2: getFolderFiles("/Users/albert.li/Desktop/196X"),
        }).toMatchSnapshot();
    });
    it("should create path file list", () => {
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
        buildDataNode(roots, "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/image1-3.jpg");
        expect(getFolderFiles("/Users/albert.li/Desktop")).toMatchSnapshot();
    });
});
