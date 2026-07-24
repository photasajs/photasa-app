import type { DirectorySelection } from "@photasa/common";
import { open } from "@tauri-apps/plugin-dialog";

type OpenDirectoryDialog = (options: {
    directory: true;
    multiple: boolean;
}) => Promise<string | string[] | null>;

interface DialogTransportDependencies {
    open: OpenDirectoryDialog;
}

export class DialogTransport {
    constructor(
        private readonly dependencies: DialogTransportDependencies = {
            open: open as OpenDirectoryDialog,
        },
    ) {}

    async chooseDirectories(multiple: boolean): Promise<DirectorySelection> {
        const selected = await this.dependencies.open({ directory: true, multiple });
        const filePaths = Array.isArray(selected) ? selected : selected ? [selected] : [];
        return { filePaths };
    }
}
