import { ILisshimingService } from "@/interfaces/li-shi-ming.interface";
import { App } from "vue";

import { YUAN_TIAN_GANG_TOKEN } from "../interfaces/yuan-tian-gang.interface";
import { YuanTianGangService } from "./yuan-tian-gang.service";
import { FANG_XUAN_LING_TOKEN } from "../interfaces/fang-xuan-ling.interface";
import { FangXuanLingService } from "./fang-xuan-ling.service";
import { CHU_SUI_LIANG_TOKEN } from "../interfaces/chu-sui-liang.interface";
import { ChusuiliangService } from "./chu-sui-liang.service";
import { XUANZANG_TOKEN } from "../interfaces/xuan-zang.interface";
import { XuanzangService } from "./xuan-zang.service";

import { loggers } from "@common/logger";
const logger = loggers.lishiming;

export class LisshimingService implements ILisshimingService {
    private yuanTianGangService!: YuanTianGangService;
    private fangXuanLingService!: FangXuanLingService;
    private chuSuiLiangService!: ChusuiliangService;
    private xuanzangService!: XuanzangService;

    constructor(private app: App) {
        logger.info("👑 李世民登基");
    }

    get isEmployed() {
        return (
            this.yuanTianGangService &&
            this.fangXuanLingService &&
            this.chuSuiLiangService &&
            this.xuanzangService
        );
    }

    private employ() {
        if (this.isEmployed) {
            logger.info("👑 朝堂重臣已就任");
            return;
        }

        logger.info("👑 袁天罡钦天监服务就任");
        this.yuanTianGangService = new YuanTianGangService();
        this.app.provide(YUAN_TIAN_GANG_TOKEN, this.yuanTianGangService);

        logger.info("👑 房玄龄宰相服务就任");
        this.fangXuanLingService = new FangXuanLingService(this.yuanTianGangService);
        this.app.provide(FANG_XUAN_LING_TOKEN, this.fangXuanLingService);

        logger.info("👑 褚遂良中书令服务就任");
        this.chuSuiLiangService = new ChusuiliangService(this.fangXuanLingService);
        this.app.provide(CHU_SUI_LIANG_TOKEN, this.chuSuiLiangService);

        logger.info("👑 玄奘法师服务就任");
        this.xuanzangService = new XuanzangService(this.fangXuanLingService);
        this.app.provide(XUANZANG_TOKEN, this.xuanzangService);
    }

    async startZhengguan() {
        logger.info("👑 开始启动大唐贞观之治");
        this.employ();
        // 初始化偏好, 语言设置
        try {
            logger.info("👑 褚遂良中书令服务初始化偏好设置");
            await this.chuSuiLiangService.initializePreferences();

            logger.info("👑 玄奘法师服务初始化偏好设置");
            await this.xuanzangService.initializeLocalization();
        } catch (error) {
            logger.error("👑偏好设置初始化失败，继续启动应用:", error);
        }
    }
}
