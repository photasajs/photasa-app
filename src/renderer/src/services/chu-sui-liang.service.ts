import { IChusuiliangService } from "../interfaces/chu-sui-liang.interface";
import { IFangXuanLingService } from "../interfaces/fang-xuan-ling.interface";
import { loggers } from "@common/logger";
import {
    ZOUZHE_MATTERS,
    ZOUZHE_PRIORITIES,
    GUANYUAN_NAMES,
    type Zouzhe,
} from "../interfaces/fang-xuan-ling.interface";

const logger = loggers.chusuiliang;

export class ChusuiliangService implements IChusuiliangService {
    constructor(private fangXuanLingService: IFangXuanLingService) {
        logger.info("🔮 就任，开始处理偏好管理");
    }
    /**
     * 初始化偏好设置
     * 直接通过preference store调用Tianshu工作流加载偏好设置
     */
    async initializePreferences() {
        try {
            logger.info("📦 向房玄龄宰相发送奏折，请求获取偏好设置");
            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.CHU_SUILIANG,
                matter: ZOUZHE_MATTERS.GET_PREFERENCES,
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };
            await this.fangXuanLingService.processZouzhe(zouzhe);
            logger.info("📦 偏好设置初始化完成");
        } catch (error) {
            // 失败时使用本地偏好设置，不影响应用启动
            logger.error("📦 初始化偏好设置失败:", error);
            logger.info("📦 使用本地默认偏好设置继续启动");
        }
    }
}
