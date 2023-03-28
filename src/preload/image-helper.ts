import { readChunk } from "read-chunk";
import imageType, { minimumBytes } from "image-type";
import { electronAPI } from "@electron-toolkit/preload";
import type { ThumbnailRequest, ImageInfo } from "./types";
import { getExifInfo } from "./exif-helper";
import path from "path";
import config from "./config";
import heic2any from "heic2any";
import sharp from "sharp";

const { ipcRenderer } = electronAPI;
const heicExtensionRE = new RegExp(`\\.(${config.acceptedHeicExtensions.join("|")})$`, "i");

export function buildThumbnailPath(photoPath: string): string {
    // Prepare thumbnail path for image
    const dir = path.join(path.dirname(photoPath), ".photasaoriginals");
    return path.join(dir, `thumbnail-${path.basename(photoPath)}.png`);
}

export async function getImageType(path: string): Promise<ImageInfo> {
    const buffer = await readChunk(path, { length: minimumBytes });
    const tags = await getExifInfo(path);
    const result = await imageType(buffer);
    return {
        imageType: result,
        tags,
    };
}

// Workaround: Prevent tree-shaking from removing `heic2any`.
heic2any["__dummy"] = 1;

function decodeBuffer(buffer: ArrayBuffer): Promise<ImageData[]> {
    return new Promise((resolve, reject) => {
        const id = (Math.random() * new Date().getTime()).toString();
        const message = { id, buffer };
        window.__heic2any__worker.postMessage(message);
        window.__heic2any__worker.addEventListener("message", (message) => {
            if (message.data.id === id) {
                if (message.data.error) {
                    return reject(message.data.error);
                }
                return resolve(message.data.imageDataArr);
            }
        });
    });
}

export function fileUrlFromPath(path: string): string {
    // Original code from https://github.com/sindresorhus/file-url/blob/master/index.js
    // (But without dependency to node.js)

    path = path.replace(/\\/g, "/");

    if (path[0] !== ".") {
        // This is an absolute URL
        if (path[0] !== "/") {
            // Windows drive letter must be prefixed with a slash
            path = `///${path}`;
        } else {
            path = `//${path}`;
        }
    }

    // Escape required characters for path components
    // See: https://tools.ietf.org/html/rfc3986#section-3.3
    return encodeURI(`file:${path}`).replace(/[?#]/g, encodeURIComponent);
}

async function decodeHeic(filePath: string): Promise<ImageData[]> {
    const encodedHeicBuffer = await (await fetch(fileUrlFromPath(filePath))).arrayBuffer();
    return await decodeBuffer(encodedHeicBuffer);
}

async function createPreviewImage(filePath: string, image: ImageData): Promise<string> {
    const fileName = path.basename(filePath, path.extname(filePath));
    const previewName = path.join(path.dirname(filePath), `.photasaoriginals/${fileName}.jpeg`);
    try {
        await sharp(image.data, {
            raw: {
                width: image.width,
                height: image.height,
                channels: 4,
            },
        })
            .toFormat("jpeg")
            .toFile(previewName);

        return previewName;
    } catch (e) {
        console.error(e);
        return "";
    }
}

export function createThumbnail(request: ThumbnailRequest): Promise<ThumbnailRequest> {
    if (heicExtensionRE.test(request.path)) {
        return decodeHeic(request.path)
            .then((imageData) => {
                return createPreviewImage(request.path, imageData[0]);
            })
            .then((previewName) => {
                request.preview = previewName;
                return ipcRenderer.invoke("picasa:create-thumbnail", request);
            });
    }
    // Start file watching
    return ipcRenderer.invoke("picasa:create-thumbnail", request);
}

export function removeThumbnail(request: ThumbnailRequest): Promise<ThumbnailRequest> {
    // Start file watching
    return ipcRenderer.invoke("picasa:remove-thumbnail", request);
}
