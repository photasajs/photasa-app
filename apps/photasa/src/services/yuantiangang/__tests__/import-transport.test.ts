import { describe, expect, it, vi } from "vitest";
import { ImportTransport } from "../transport/import-transport";

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((next) => {
        resolve = next;
    });
    return { promise, resolve };
}

describe("ImportTransport (RFC 0154 Phase 2d)", () => {
    it("installs import listeners before execute_import can run", async () => {
        const registrations = [
            deferred<() => void>(),
            deferred<() => void>(),
            deferred<() => void>(),
            deferred<() => void>(),
        ];
        const listen = vi.fn((_name: string, _handler: (event: { payload: unknown }) => void) => {
            return registrations[listen.mock.calls.length - 1].promise;
        });
        const invoke = vi.fn().mockResolvedValue("import-1");
        const transport = new ImportTransport({ listen, invoke });

        const execution = transport.execute("execute_import", { config: { targetPath: "/tmp" } });
        await Promise.resolve();
        expect(invoke).not.toHaveBeenCalled();

        registrations.forEach((registration) => registration.resolve(vi.fn()));
        await expect(execution).resolves.toBe("import-1");
        expect(invoke).toHaveBeenCalledWith("execute_import", {
            config: { targetPath: "/tmp" },
        });
    });

    it("uses Rust args wrappers for session commands", async () => {
        const invoke = vi.fn().mockResolvedValue(undefined);
        const transport = new ImportTransport({
            listen: vi.fn(async () => vi.fn()),
            invoke,
        });

        await transport.execute("pause_import", { importId: "import-2" });
        await transport.execute("resume_import", { importId: "import-2" });
        await transport.execute("cancel_import", { importId: "import-2" });
        await transport.execute("get_import_history", { limit: 10 });
        await transport.execute("get_import_details", { historyId: "history-1" });
        await transport.execute("undo_import_execute", { historyId: "history-1" });
        await transport.execute("get_import_progress", { importId: "import-2" });
        await transport.execute("cleanup_recoverable_import", { importId: "import-2" });

        expect(invoke.mock.calls).toEqual([
            ["pause_import", { args: { importId: "import-2" } }],
            ["resume_import", { args: { importId: "import-2" } }],
            ["cancel_import", { args: { importId: "import-2" } }],
            ["get_import_history", { args: { limit: 10 } }],
            ["get_import_details", { args: { historyId: "history-1" } }],
            ["undo_import_execute", { args: { historyId: "history-1" } }],
            ["get_import_progress", { args: { importId: "import-2" } }],
            ["cleanup_recoverable_import", { args: { importId: "import-2" } }],
        ]);
    });

    it("registers one listener per event and unsubscribes projections independently", async () => {
        const handlers = new Map<string, (event: { payload: unknown }) => void>();
        const unlisteners = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
        const listen = vi.fn(
            async (name: string, handler: (event: { payload: unknown }) => void) => {
                handlers.set(name, handler);
                return unlisteners[listen.mock.calls.length - 1];
            },
        );
        const transport = new ImportTransport({ listen, invoke: vi.fn() });
        await transport.ready();

        const first = vi.fn();
        const second = vi.fn();
        const unsubscribeFirst = transport.onProgress(first);
        unsubscribeFirst();
        transport.onProgress(second);
        handlers.get("import:progress")?.({
            payload: {
                importId: "import-3",
                totalFiles: 2,
                processedFiles: 1,
                startTime: "2026-07-24T00:00:00.000Z",
            },
        });

        expect(listen).toHaveBeenCalledTimes(4);
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
        expect(second.mock.calls[0][0].startTime).toBeInstanceOf(Date);

        transport.destroy();
        unlisteners.forEach((unlisten) => expect(unlisten).toHaveBeenCalledTimes(1));
    });

    it("cleans successful listeners when one listener registration fails", async () => {
        const unlisteners = [vi.fn(), vi.fn(), vi.fn()];
        let successful = 0;
        const listen = vi.fn(async (name: string) => {
            if (name === "import:error") throw new Error("event unavailable");
            return unlisteners[successful++];
        });
        const transport = new ImportTransport({ listen, invoke: vi.fn() });

        await expect(transport.ready()).rejects.toThrow("event unavailable");
        unlisteners.forEach((unlisten) => expect(unlisten).toHaveBeenCalledTimes(1));
    });
});
