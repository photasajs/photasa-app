import { loggers } from "@photasa/common";
import {
    GUANYUAN_NAMES,
    ZOUZHE_MATTERS,
    ZOUZHE_PRIORITIES,
    type Zouzhe,
} from "@renderer/interfaces/fang-xuan-ling.interface";
import type { IFangXuanLingService } from "@renderer/interfaces/fang-xuan-ling.interface";
import { buildInitialConsentDelta, buildSettingsConsentDelta } from "./telemetry-consent";
import type { TelemetryConsentStatus } from "@renderer/constants/telemetry";
import { syncPosthogWithConsent } from "./posthog-client";

const logger = loggers.lishimin;

export async function persistTelemetryConsent(
    fangXuanLingService: IFangXuanLingService,
    consentStatus: TelemetryConsentStatus,
    options?: { fromDialog?: boolean; existingPolicyVersion?: string },
): Promise<void> {
    const delta =
        options?.fromDialog === false && options.existingPolicyVersion !== undefined
            ? buildSettingsConsentDelta(consentStatus, options.existingPolicyVersion)
            : buildInitialConsentDelta(consentStatus);

    const zouzhe: Zouzhe = {
        department: GUANYUAN_NAMES.CHU_SUILIANG,
        matter: ZOUZHE_MATTERS.UPDATE_PREFERENCES,
        content: delta,
        timestamp: Date.now(),
        priority: ZOUZHE_PRIORITIES.NORMAL,
    };

    await fangXuanLingService.processZouzhe(zouzhe);
    syncPosthogWithConsent(consentStatus);
    logger.info(`🏛️ 遥测同意已落盘: ${consentStatus}`);
}
