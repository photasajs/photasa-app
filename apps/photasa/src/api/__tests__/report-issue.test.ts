import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitReportIssue } from "../report-issue";

vi.mock("@tauri-apps/api/app", () => ({
    getVersion: vi.fn().mockResolvedValue("2.2.0"),
}));

describe("submitReportIssue", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("posts desktop issue payload to photasa.me", async () => {
        const fetchImpl = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                issue: { number: 42, htmlUrl: "https://github.com/org/repo/issues/42" },
            }),
        });

        const result = await submitReportIssue(
            {
                title: "Crash on import",
                body: "Steps to reproduce",
                category: "bug",
                email: "user@example.com",
            },
            { fetchImpl },
        );

        expect(result).toEqual({ number: 42, htmlUrl: "https://github.com/org/repo/issues/42" });
        expect(fetchImpl).toHaveBeenCalledWith(
            "https://photasa.me/api/issues",
            expect.objectContaining({
                method: "POST",
                headers: { "Content-Type": "application/json" },
            }),
        );

        const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
        expect(body.source).toBe("desktop");
        expect(body.category).toBe("bug");
        expect(body.metadata.appVersion).toBe("2.2.0");
    });

    it("throws when API returns an error", async () => {
        const fetchImpl = vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ error: "rate limited" }),
        });

        await expect(
            submitReportIssue({ title: "x", body: "y", category: "general" }, { fetchImpl }),
        ).rejects.toThrow("rate limited");
    });
});
