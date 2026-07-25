import { describe, it, expect, vi, beforeEach } from "vitest";
import { TELEMETRY_CONSENT_STATUS } from "@renderer/constants/telemetry";

const posthogMock = vi.hoisted(() => ({
    init: vi.fn(),
    capture: vi.fn(),
    opt_out_capturing: vi.fn(),
    reset: vi.fn(),
}));

vi.mock("posthog-js", () => ({
    default: posthogMock,
}));

import {
    captureTelemetryEvent,
    initPosthogIfGranted,
    isPosthogInitializedForTests,
    resetPosthogForTests,
    shutdownPosthog,
    syncPosthogWithConsent,
} from "../posthog-client";

describe("posthog-client", () => {
    beforeEach(() => {
        resetPosthogForTests();
        vi.clearAllMocks();
    });

    it("undecided 时不初始化 PostHog", () => {
        initPosthogIfGranted(TELEMETRY_CONSENT_STATUS.UNDECIDED);
        expect(posthogMock.init).not.toHaveBeenCalled();
        expect(isPosthogInitializedForTests()).toBe(false);
    });

    it("granted 时初始化 PostHog", () => {
        initPosthogIfGranted(TELEMETRY_CONSENT_STATUS.GRANTED);
        expect(posthogMock.init).toHaveBeenCalledTimes(1);
        expect(isPosthogInitializedForTests()).toBe(true);
    });

    it("未初始化时 capture 为 no-op", () => {
        captureTelemetryEvent("test_event", { ok: true });
        expect(posthogMock.capture).not.toHaveBeenCalled();
    });

    it("syncPosthogWithConsent denied 时关闭客户端", () => {
        initPosthogIfGranted(TELEMETRY_CONSENT_STATUS.GRANTED);
        syncPosthogWithConsent(TELEMETRY_CONSENT_STATUS.DENIED);
        expect(posthogMock.opt_out_capturing).toHaveBeenCalled();
        expect(posthogMock.reset).toHaveBeenCalled();
        expect(isPosthogInitializedForTests()).toBe(false);
    });

    it("shutdownPosthog 在未初始化时为 no-op", () => {
        shutdownPosthog();
        expect(posthogMock.opt_out_capturing).not.toHaveBeenCalled();
    });
});
