export interface StatusBarViewInput {
    type: string;
    status: string;
    currentTask: string;
    error?: string;
    data?: unknown;
}

export type StatusBarView =
    | { kind: "ready" }
    | { kind: "task"; label: string }
    | { kind: "progress"; label: string; processed?: number; total?: number }
    | { kind: "error"; label: string };

interface ProgressData {
    currentFile?: unknown;
    processed?: unknown;
    progress?: unknown;
    total?: unknown;
}

function readProgressData(data: unknown): ProgressData {
    return data && typeof data === "object" ? (data as ProgressData) : {};
}

function readNumber(value: unknown): number | undefined {
    return typeof value === "number" ? value : undefined;
}

export function deriveStatusBarView(input: StatusBarViewInput): StatusBarView {
    if (input.status === "error") {
        return { kind: "error", label: input.error || input.currentTask };
    }

    if (
        !input.status ||
        input.status === "ready" ||
        (input.type === "scan" && input.status === "complete")
    ) {
        return { kind: "ready" };
    }

    if (input.type === "scan" && input.status === "progress") {
        const data = readProgressData(input.data);
        return {
            kind: "progress",
            label: typeof data.currentFile === "string" ? data.currentFile : input.currentTask,
            processed: readNumber(data.processed) ?? readNumber(data.progress),
            total: readNumber(data.total),
        };
    }

    return input.currentTask ? { kind: "task", label: input.currentTask } : { kind: "ready" };
}
