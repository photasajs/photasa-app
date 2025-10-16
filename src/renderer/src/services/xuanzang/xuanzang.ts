import { IXuanzangService } from "@/interfaces/xuan-zang.interface";
import { loggers } from "@common/logger";
import { IFangXuanLingService } from "@/interfaces/fang-xuan-ling.interface";
import { i18n } from "../../i18n/config";
import { watch } from "vue";

const logger = loggers.xuanzang;

export class XuanzangService implements IXuanzangService {
    constructor(private fangXuanLingService: IFangXuanLingService) {
        logger.info("🔮 就任，开始处理玄奘法师");
    }

    async initializeLocalization() {
        logger.info("📦 玄奘法师初始化偏好设置");

        // 设置初始语言
        const locale = this.fangXuanLingService.preference.currentLanguage as
            | "en-US"
            | "zh-CN"
            | "ja-JP"
            | "ko-KR"
            | "fr-FR"
            | "de-DE"
            | "es-ES";
        (i18n.global.locale as unknown as import("vue").Ref<string>).value = locale;
        document.querySelector("html")?.setAttribute("lang", locale);

        // Watch for changes to keep i18n in sync with Pinia
        watch(
            () => this.fangXuanLingService.preference.currentLanguage,
            (newLocale) => {
                (i18n.global.locale as unknown as import("vue").Ref<string>).value = newLocale;
                document.querySelector("html")?.setAttribute("lang", newLocale);
            },
        );
    }
}
