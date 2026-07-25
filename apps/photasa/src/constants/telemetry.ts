/** PostHog 遥测常量（RFC 0163） */

export const POSTHOG_API_KEY = "phc_ohBeDHC9RNkG6HkWdbJdjPtacoDTxDjEnZbnYGuVmmja";
export const POSTHOG_HOST = "https://us.i.posthog.com";

/** 当前隐私政策版本；仅政策实质变更时递增 */
export const CURRENT_TELEMETRY_POLICY_VERSION = "1";

export const TELEMETRY_CONSENT_STATUS = {
    UNDECIDED: "undecided",
    GRANTED: "granted",
    DENIED: "denied",
} as const;

export type TelemetryConsentStatus =
    (typeof TELEMETRY_CONSENT_STATUS)[keyof typeof TELEMETRY_CONSENT_STATUS];

export interface TelemetryPreferences {
    consentStatus: TelemetryConsentStatus;
    consentPolicyVersion: string;
}

export const DEFAULT_TELEMETRY_PREFERENCES: TelemetryPreferences = {
    consentStatus: TELEMETRY_CONSENT_STATUS.UNDECIDED,
    consentPolicyVersion: "",
};
