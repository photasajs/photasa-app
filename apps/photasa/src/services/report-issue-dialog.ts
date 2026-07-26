/** Registers App.vue opener for Help → Report Issue menu action */
let openDialog: (() => void) | null = null;

export function registerReportIssueDialogOpener(handler: () => void): void {
    openDialog = handler;
}

export function openReportIssueDialog(): void {
    openDialog?.();
}

export function clearReportIssueDialogOpener(): void {
    openDialog = null;
}
