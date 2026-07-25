import posthog from "posthog-js";
import type { App } from "vue";
import { loggers } from "@photasa/common";
import {
    POSTHOG_API_KEY,
    POSTHOG_HOST,
    type TelemetryConsentStatus,
} from "@renderer/constants/telemetry";
import { shouldInitializeTelemetry } from "./telemetry-consent";

const logger = loggers.app;

let initialized = false;

/** 仅在 granted 时初始化 PostHog；未同意前零出站请求 */
export function initPosthogIfGranted(consentStatus: TelemetryConsentStatus): void {
    if (!shouldInitializeTelemetry(consentStatus) || initialized) {
        return;
    }

    posthog.init(POSTHOG_API_KEY, {
        api_host: POSTHOG_HOST,
        autocapture: false,
        capture_pageview: false,
        persistence: "localStorage",
        disable_session_recording: true,
    });
    initialized = true;
    logger.info("🏛️ 遥测已启用（PostHog 前端）");
}

/** 撤回同意或拒绝时关闭客户端 */
export function shutdownPosthog(): void {
    if (!initialized) {
        return;
    }
    posthog.opt_out_capturing();
    posthog.reset();
    initialized = false;
    logger.info("🏛️ 遥测已关闭（PostHog 前端）");
}

/** 根据最新同意状态切换 PostHog 生命周期 */
export function syncPosthogWithConsent(consentStatus: TelemetryConsentStatus): void {
    if (shouldInitializeTelemetry(consentStatus)) {
        initPosthogIfGranted(consentStatus);
        return;
    }
    shutdownPosthog();
}

export function captureTelemetryEvent(
    eventName: string,
    properties?: Record<string, string | number | boolean>,
): void {
    if (!initialized) {
        return;
    }
    posthog.capture(eventName, properties);
}

export function installVueErrorHandler(app: App): void {
    const previousHandler = app.config.errorHandler;
    app.config.errorHandler = (error, instance, info) => {
        captureTelemetryEvent("vue_error", {
            message: error instanceof Error ? error.message : String(error),
            info,
        });
        previousHandler?.(error, instance, info);
    };
}

export function installGlobalErrorHandlers(): () => void {
    const onError = (event: ErrorEvent) => {
        captureTelemetryEvent("window_error", {
            message: event.message,
        });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
        captureTelemetryEvent("unhandled_rejection", {
            message:
                event.reason instanceof Error
                    ? event.reason.message
                    : String(event.reason ?? "unknown"),
        });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
        window.removeEventListener("error", onError);
        window.removeEventListener("unhandledrejection", onRejection);
    };
}

export function isPosthogInitializedForTests(): boolean {
    return initialized;
}

export function resetPosthogForTests(): void {
    shutdownPosthog();
}
