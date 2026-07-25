import {
    CURRENT_TELEMETRY_POLICY_VERSION,
    TELEMETRY_CONSENT_STATUS,
    type TelemetryConsentStatus,
    type TelemetryPreferences,
} from "@renderer/constants/telemetry";

/** 是否应初始化 PostHog（Rust + 前端共用逻辑） */
export function shouldInitializeTelemetry(consentStatus: TelemetryConsentStatus): boolean {
    return consentStatus === TELEMETRY_CONSENT_STATUS.GRANTED;
}

/** 是否展示首次同意对话框 */
export function needsConsentDialog(consentStatus: TelemetryConsentStatus): boolean {
    return consentStatus === TELEMETRY_CONSENT_STATUS.UNDECIDED;
}

/**
 * 隐私政策版本不一致时重置为 undecided（与 Rust reconcile 对齐）
 */
export function reconcileTelemetryConsent(
    telemetry: TelemetryPreferences,
    currentPolicyVersion: string = CURRENT_TELEMETRY_POLICY_VERSION,
): TelemetryPreferences {
    if (telemetry.consentStatus === TELEMETRY_CONSENT_STATUS.UNDECIDED) {
        return telemetry;
    }
    if (telemetry.consentPolicyVersion !== currentPolicyVersion) {
        return {
            ...telemetry,
            consentStatus: TELEMETRY_CONSENT_STATUS.UNDECIDED,
        };
    }
    return telemetry;
}

/** 首次对话框选择后写入的偏好载荷 */
export function buildInitialConsentDelta(
    consentStatus: TelemetryConsentStatus,
    currentPolicyVersion: string = CURRENT_TELEMETRY_POLICY_VERSION,
): { telemetry: TelemetryPreferences } {
    return {
        telemetry: {
            consentStatus,
            consentPolicyVersion:
                consentStatus === TELEMETRY_CONSENT_STATUS.UNDECIDED ? "" : currentPolicyVersion,
        },
    };
}

/** Settings 手动切换：仅改 consentStatus，不更新 policy version */
export function buildSettingsConsentDelta(
    consentStatus: TelemetryConsentStatus,
    existingPolicyVersion: string,
): { telemetry: TelemetryPreferences } {
    return {
        telemetry: {
            consentStatus,
            consentPolicyVersion: existingPolicyVersion,
        },
    };
}
