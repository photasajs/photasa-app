export interface FileAction {
    file: string;
    name: string;
    created?: Date;
    targetName?: string;
    isImage: boolean;
    isVideo: boolean;
    target?: string;
    targetDir: string;
    targetFileName: string;
    targetFullPath: string;
}

export interface FileException {
    code?: string;
}
