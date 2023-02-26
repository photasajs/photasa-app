export interface FileAction {
    file: string;
    name: string;
    created?: Date;
    targetName?: string;
    notImage: boolean;
    target?: string;
    targetDir: string;
}
