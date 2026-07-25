import { getVersion } from "@tauri-apps/api/app";
import { PHOTASA_ME_ISSUES_URL } from "@renderer/constants/photasa-me-api";

export interface ReportIssueInput {
    title: string;
    body: string;
    category: "bug" | "feature" | "support" | "general";
    email?: string;
}

export interface ReportIssueResult {
    number: number;
    htmlUrl: string;
}

interface ReportIssueResponse {
    success: boolean;
    issue?: {
        number: number;
        htmlUrl: string;
    };
    error?: string;
}

async function buildDesktopMetadata(): Promise<Record<string, string>> {
    const metadata: Record<string, string> = {
        platform: navigator.platform,
        locale: navigator.language,
    };

    try {
        metadata.appVersion = await getVersion();
    } catch {
        // Web-only dev: version unavailable
    }

    return metadata;
}

export async function submitReportIssue(
    input: ReportIssueInput,
    options: { apiKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<ReportIssueResult> {
    const fetchImpl = options.fetchImpl ?? fetch;
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    if (options.apiKey) {
        headers.Authorization = `Bearer ${options.apiKey}`;
    }

    const response = await fetchImpl(PHOTASA_ME_ISSUES_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
            title: input.title,
            body: input.body,
            category: input.category,
            source: "desktop",
            email: input.email,
            metadata: await buildDesktopMetadata(),
        }),
    });

    const payload = (await response.json()) as ReportIssueResponse;

    if (!response.ok || !payload.issue) {
        throw new Error(payload.error ?? "Failed to submit issue");
    }

    return {
        number: payload.issue.number,
        htmlUrl: payload.issue.htmlUrl,
    };
}
