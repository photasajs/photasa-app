import { buildDataNode } from "../folder-tree";
import type { DataNode } from "ant-design-vue/es/tree";

describe("Folder Tree", () => {
    it("should return a DataNode", () => {
        const roots: DataNode[] = [];
        const path = "/test/google.com/test.jpg";

        buildDataNode(roots, {
            path,
            thumbnail: "/test/google.com/.picasaoriginals/test.jpg",
            isVideo: false,
        });
    });

    /*
    it("should build path tree node with one path", () => {
        const roots = [];
        buildDataNode(roots, {
            path: "/test/Goodbye/test.jpg",
            thumbnail: "/test/Goodbye/.picasaoriginals/test.jpg",
        });
        buildDataNode(roots, {
            path: "/test/Goodbye/test2.jpg",
            thumbnail: "/test/Goodbye/.picasaoriginals/test2.jpg",
        });
        expect({
            roots,
            fileList1: getFolderFiles("/test"),
            fileList2: getFolderFiles("/test/Goodbye"),
        }).toMatchSnapshot();
    });

    it("should build path tree node with multiple", () => {
        const roots = [];
        buildDataNode(roots, {
            path: "/test/Goodbye/test.jpg",
            thumbnail: "/test/Goodbye/.picasaoriginals/test.jpg",
        });
        buildDataNode(roots, {
            path: "/test/go/test2.jpg",
            thumbnail: "/test/go/.picasaoriginals/test2.jpg",
        });
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
        buildDataNode(roots, {
            path: "/test/Goodbye/asas/test.jpg",
            thumbnail: "/test/Goodbye/asas/.picasaoriginals/test.jpg",
        });
        buildDataNode(roots, {
            path: "/test/go/sdks/test2.jpg",
            thumbnail: "/test/go/sdks/.picasaoriginals/test2.jpg",
        });
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
        buildDataNode(roots, {
            path: "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/image0-15.jpg",
            thumbnail:
                "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/.picasaoriginals/image0-15.jpg",
        });
        buildDataNode(roots, {
            path: "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/image1-1.jpg",
            thumbnail:
                "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/.picasaoriginals/image1-1.jpg",
        });
        buildDataNode(roots, {
            path: "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/image1-1.jpg",
            thumbnail:
                "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/.picasaoriginals/image1-1.jpg",
        });
        buildDataNode(roots, {
            path: "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/image1-2.jpg",
            thumbnail:
                "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/.picasaoriginals/image1-2.jpg",
        });
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
        buildDataNode(roots, {
            path: "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/image0-15.jpg",
            thumbnail:
                "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/.picasaoriginals/image0-15.jpg",
        });
        buildDataNode(roots, {
            path: "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/image1-1.jpg",
            thumbnail:
                "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/.picasaoriginals/image1-1.jpg",
        });
        buildDataNode(roots, {
            path: "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/image1-1.jpg",
            thumbnail:
                "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/.picasaoriginals/image1-1.jpg",
        });
        buildDataNode(roots, {
            path: "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/image1-2.jpg",
            thumbnail:
                "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/.picasaoriginals/image1-2.jpg",
        });
        buildDataNode(roots, {
            path: "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/image1-3.jpg",
            thumbnail:
                "/Users/albert.li/Desktop/196X/19610000_天津_老爸戎装/.picasaoriginals/image1-3.jpg",
        });
        expect(getFolderFiles("/Users/albert.li/Desktop")).toMatchSnapshot();
    });
    */
});
