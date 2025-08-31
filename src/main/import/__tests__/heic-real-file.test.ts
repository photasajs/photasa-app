import { describe, it, expect, beforeAll } from "vitest";
import { extractMetadata, processFileGroup } from "../import-handler";
import type { MetadataRequest, FileGroup, FileInfo } from "@common/import-types";
import type { PhotasaLogger } from "@common/logger";
import path from "path";
import fs from "fs-extra";
import ExifReader from "exifreader";

const mockLogger: PhotasaLogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
} as any;

describe("HEIC Real File Test", () => {
    const testDataDir = path.join(__dirname, "data");
    const heicFilePath = path.join(testDataDir, "20211104_040327323_iOS.heic");

    beforeAll(async () => {
        // 确保测试文件存在
        if (!(await fs.pathExists(heicFilePath))) {
            throw new Error(`Test HEIC file not found: ${heicFilePath}`);
        }
    });

    it("should extract EXIF data from real HEIC file using ExifReader", async () => {
        // 这个测试只测试EXIF提取，不依赖WASM模块
        const buffer = await fs.readFile(heicFilePath);
        const tags = ExifReader.load(buffer);

        // 验证基本EXIF标签存在
        expect(tags).toBeDefined();
        expect(tags.Make).toBeDefined();
        expect(tags.Model).toBeDefined();

        // 验证相机信息
        expect(tags.Make?.description).toBe("Apple");
        expect(tags.Model?.description).toContain("iPhone");

        // 验证日期时间字段存在（这个HEIC文件必须有DateTimeOriginal）
        expect(tags.DateTimeOriginal).toBeDefined();
        expect(tags.DateTimeOriginal?.value).toBeDefined();
        expect(tags.DateTimeOriginal?.value?.[0]).toBeDefined();

        // 验证时区转换功能
        const exifDateStr = tags.DateTimeOriginal?.value?.[0];
        const dateStr = exifDateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
        const date = new Date(dateStr);

        expect(isNaN(date.getTime())).toBe(false);
        expect(date.getFullYear()).toBe(2021);
        expect(date.getMonth()).toBe(10); // 11月
        expect(date.getDate()).toBe(3); // 3日
    });

    it.skip("should extract EXIF metadata from real HEIC file (integration test)", async () => {
        // 这是集成测试，需要WASM模块支持
        // 在CI环境中可能无法运行，所以跳过
        // 可以在本地开发环境中手动开启测试
        // 获取文件统计信息
        const stats = await fs.stat(heicFilePath);

        // 创建元数据请求
        const request: MetadataRequest = {
            filePath: heicFilePath,
        };

        // 提取元数据
        const metadata = await extractMetadata(request, mockLogger);

        // 验证基本信息 - HEIC文件必须的属性
        expect(metadata.type).toBe("image");
        expect(metadata.name).toBe("20211104_040327323_iOS.heic");
        expect(metadata.size).toBe(stats.size);
        expect(metadata.format).toBe("HEIC");

        // 验证EXIF日期提取 - HEIC文件应该有有效的EXIF日期
        expect(metadata.dateTime).toBeInstanceOf(Date);
        expect(isNaN((metadata.dateTime as Date).getTime())).toBe(false);
        expect(metadata.dateSource).toBe("exif");

        // 验证图像尺寸 - HEIC文件必须有有效的宽高
        const imageMetadata = metadata as any;
        expect(imageMetadata.width).toBeGreaterThan(0);
        expect(imageMetadata.height).toBeGreaterThan(0);

        // 验证相机信息 - iPhone拍摄的HEIC文件应该有相机信息
        expect(imageMetadata.cameraInfo).toBeDefined();
        expect(imageMetadata.cameraInfo.make).toBe("Apple");
        expect(imageMetadata.cameraInfo.model).toContain("iPhone");

        // 验证按照真实EXIF数据的日期（根据实际文件的EXIF内容）
        const actualDate = metadata.dateTime as Date;
        expect(actualDate.getFullYear()).toBe(2021);
        expect(actualDate.getMonth()).toBe(10); // 11月（从0开始）
        // 日期可能是3日或4日，取决于时区转换和实际EXIF内容
        expect([3, 4].includes(actualDate.getDate())).toBe(true);
    });

    it.skip("should process file group with real HEIC file and generate correct target path (integration test)", async () => {
        // 这是集成测试，需要WASM模块支持
        // 获取文件统计信息
        const stats = await fs.stat(heicFilePath);

        // 首先提取元数据以获得正确的日期时间
        const request: MetadataRequest = { filePath: heicFilePath };
        const metadata = await extractMetadata(request, mockLogger);

        // 创建FileInfo对象
        const fileInfo: FileInfo = {
            path: heicFilePath,
            name: path.basename(heicFilePath),
            size: stats.size,
            type: "image",
            dateSource: metadata.dateSource,
            dateTime: metadata.dateTime,
            createdTime: stats.birthtime,
            modifiedTime: stats.mtime,
            file: heicFilePath,
            isImage: true,
            isVideo: false,
            target: "",
            targetDir: "",
            targetFileName: path.basename(heicFilePath),
            targetFullPath: "",
        };

        // 创建文件组
        const fileGroup: FileGroup = {
            mainFile: fileInfo,
            files: [fileInfo],
            type: "single",
            totalSize: stats.size,
        };

        // 处理文件组
        const processedGroup = await processFileGroup(fileGroup, mockLogger);

        // 验证目标路径基本格式
        expect(processedGroup.targetPath).toBeDefined();
        expect(processedGroup.targetPath).not.toContain("NaN");
        expect(processedGroup.targetPath).toMatch(/^\d{4}\/\d{8}$/);

        // 验证具体的日期路径 - 根据真实EXIF数据，应该是2021年11月的路径
        // 日期可能是03日或04日，取决于时区转换
        expect(
            ["2021/20211103", "2021/20211104"].includes(processedGroup.targetPath as string),
        ).toBe(true);

        // 验证路径组件
        const pathParts = (processedGroup.targetPath as string).split("/");
        expect(pathParts[0]).toBe("2021"); // 年份
        expect(["20211103", "20211104"].includes(pathParts[1])).toBe(true); // 年月日
    });

    it("should handle HEIC file extraction errors gracefully", async () => {
        // 测试不存在的文件
        const nonExistentPath = path.join(testDataDir, "non-existent.heic");

        const request: MetadataRequest = {
            filePath: nonExistentPath,
        };

        // 应该抛出错误
        await expect(extractMetadata(request, mockLogger)).rejects.toThrow();
    });

    it.skip("should verify complete HEIC processing pipeline (integration test)", async () => {
        // 这是集成测试，需要WASM模块支持
        // 1. 文件验证
        expect(await fs.pathExists(heicFilePath)).toBe(true);

        // 2. 元数据提取
        const request: MetadataRequest = { filePath: heicFilePath };
        const metadata = await extractMetadata(request, mockLogger);
        expect(metadata.type).toBe("image");
        expect(metadata.format).toBe("HEIC");
        expect(metadata.dateSource).toBe("exif");
        expect(metadata.dateTime).toBeInstanceOf(Date);

        // 3. 路径生成验证
        const stats = await fs.stat(heicFilePath);
        const fileInfo: FileInfo = {
            path: heicFilePath,
            name: path.basename(heicFilePath),
            size: stats.size,
            type: "image",
            dateSource: metadata.dateSource,
            dateTime: metadata.dateTime,
            createdTime: stats.birthtime,
            modifiedTime: stats.mtime,
            file: heicFilePath,
            isImage: true,
            isVideo: false,
            target: "",
            targetDir: "",
            targetFileName: path.basename(heicFilePath),
            targetFullPath: "",
        };

        const fileGroup: FileGroup = {
            mainFile: fileInfo,
            files: [fileInfo],
            type: "single",
            totalSize: stats.size,
        };

        const processedGroup = await processFileGroup(fileGroup, mockLogger);

        // 4. 完整性验证
        expect(
            ["2021/20211103", "2021/20211104"].includes(processedGroup.targetPath as string),
        ).toBe(true);
        expect(processedGroup.targetPath).toMatch(/^\d{4}\/\d{8}$/);
        expect(processedGroup.targetPath).not.toContain("NaN");
    });
});
