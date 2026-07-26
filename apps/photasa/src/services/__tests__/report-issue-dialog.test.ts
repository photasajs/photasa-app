import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    clearReportIssueDialogOpener,
    openReportIssueDialog,
    registerReportIssueDialogOpener,
} from "../report-issue-dialog";

describe("report-issue-dialog", () => {
    beforeEach(() => {
        clearReportIssueDialogOpener();
    });

    it("opens registered handler when Help → Report Issue is triggered", () => {
        const open = vi.fn();
        registerReportIssueDialogOpener(open);

        openReportIssueDialog();

        expect(open).toHaveBeenCalledTimes(1);
    });

    it("no-ops when opener was cleared on unmount", () => {
        const open = vi.fn();
        registerReportIssueDialogOpener(open);
        clearReportIssueDialogOpener();

        openReportIssueDialog();

        expect(open).not.toHaveBeenCalled();
    });
});
