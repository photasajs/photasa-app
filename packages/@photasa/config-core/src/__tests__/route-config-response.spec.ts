import { describe, it, expect } from "@jest/globals";
import { routeConfigResponse } from "../route-config-response";
import type { ConfigResponse } from "@photasa/common";

describe("routeConfigResponse", () => {
    it("heartbeat", () => {
        const data = {
            action: "heartbeat" as const,
            path: "",
            config: {} as ConfigResponse["config"],
        };
        expect(routeConfigResponse(data as ConfigResponse)).toEqual({ kind: "heartbeat" });
    });

    it("query-result", () => {
        const data = {
            action: "next" as const,
            from: "query" as const,
            path: "/p",
            config: {} as ConfigResponse["config"],
        };
        expect(routeConfigResponse(data as ConfigResponse)).toEqual({
            kind: "query-result",
            payload: data,
        });
    });

    it("add-finished on complete", () => {
        const data = {
            action: "complete" as const,
            from: "add" as const,
            queueId: 7,
            path: "",
            config: {} as ConfigResponse["config"],
        };
        expect(routeConfigResponse(data as ConfigResponse)).toEqual({
            kind: "add-finished",
            queueId: 7,
        });
    });

    it("add-finished on error", () => {
        const data = {
            action: "error" as const,
            from: "add" as const,
            queueId: 2,
            path: "",
            config: {} as ConfigResponse["config"],
        };
        expect(routeConfigResponse(data as ConfigResponse)).toEqual({
            kind: "add-finished",
            queueId: 2,
        });
    });

    it("add with action next does not match add-finished", () => {
        const data = {
            action: "next" as const,
            from: "add" as const,
            queueId: 1,
            path: "",
            config: {} as ConfigResponse["config"],
        };
        const r = routeConfigResponse(data as ConfigResponse);
        expect(r.kind).toBe("unknown");
    });

    it("remove-result", () => {
        const data = {
            action: "complete" as const,
            from: "remove" as const,
            path: "",
            config: {} as ConfigResponse["config"],
        };
        expect(routeConfigResponse(data as ConfigResponse)).toEqual({
            kind: "remove-result",
            payload: data,
        });
    });

    it("engine-status", () => {
        const data = {
            action: "engine-status" as const,
            path: "",
            config: {} as ConfigResponse["config"],
            status: "ok",
        };
        expect(routeConfigResponse(data as ConfigResponse)).toEqual({
            kind: "engine-status",
            payload: data,
        });
    });

    it("unknown", () => {
        const data = {
            action: "next" as const,
            path: "",
            config: {} as ConfigResponse["config"],
        };
        expect(routeConfigResponse(data as ConfigResponse)).toEqual({
            kind: "unknown",
            payload: data,
        });
    });
});
