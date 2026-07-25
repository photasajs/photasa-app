import { describe, it, expect } from "vitest";
import {
    buildInitialConsentDelta,
    buildSettingsConsentDelta,
    needsConsentDialog,
    reconcileTelemetryConsent,
    shouldInitializeTelemetry,
} from "../telemetry-consent";
import {
    CURRENT_TELEMETRY_POLICY_VERSION,
    TELEMETRY_CONSENT_STATUS,
} from "@renderer/constants/telemetry";

describe("telemetry-consent", () => {
    it("仅在 granted 时初始化遥测", () => {
        expect(shouldInitializeTelemetry(TELEMETRY_CONSENT_STATUS.GRANTED)).toBe(true);
        expect(shouldInitializeTelemetry(TELEMETRY_CONSENT_STATUS.DENIED)).toBe(false);
        expect(shouldInitializeTelemetry(TELEMETRY_CONSENT_STATUS.UNDECIDED)).toBe(false);
    });

    it("undecided 时展示同意对话框", () => {
        expect(needsConsentDialog(TELEMETRY_CONSENT_STATUS.UNDECIDED)).toBe(true);
        expect(needsConsentDialog(TELEMETRY_CONSENT_STATUS.GRANTED)).toBe(false);
    });

    it("政策版本不一致时重置为 undecided", () => {
        const result = reconcileTelemetryConsent({
            consentStatus: TELEMETRY_CONSENT_STATUS.GRANTED,
            consentPolicyVersion: "0",
        });
        expect(result.consentStatus).toBe(TELEMETRY_CONSENT_STATUS.UNDECIDED);
    });

    it("首次同意写入当前政策版本", () => {
        const delta = buildInitialConsentDelta(TELEMETRY_CONSENT_STATUS.GRANTED);
        expect(delta.telemetry.consentPolicyVersion).toBe(CURRENT_TELEMETRY_POLICY_VERSION);
    });

    it("设置页切换保留既有政策版本", () => {
        const delta = buildSettingsConsentDelta(TELEMETRY_CONSENT_STATUS.DENIED, "1");
        expect(delta.telemetry.consentPolicyVersion).toBe("1");
        expect(delta.telemetry.consentStatus).toBe(TELEMETRY_CONSENT_STATUS.DENIED);
    });
});
