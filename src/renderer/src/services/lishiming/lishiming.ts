import { ILisshimingService } from "@/interfaces/li-shi-ming.interface";
import { App } from "vue";

import { YUAN_TIAN_GANG_TOKEN } from "@renderer/interfaces/yuan-tian-gang.interface";
import { YuanTianGangService } from "@renderer/services/yuantiangang";
import { FANG_XUAN_LING_TOKEN } from "@renderer/interfaces/fang-xuan-ling.interface";
import { FangXuanLingService } from "@renderer/services/fangxuanling";
import { CHU_SUI_LIANG_TOKEN } from "@renderer/interfaces/chu-sui-liang.interface";
import { ChusuiliangService } from "@renderer/services/chusuiliang";
import { YU_CHI_GONG_TOKEN } from "@renderer/interfaces/yu-chi-gong.interface";
import { YuChiGongService } from "@renderer/services/yuchigong";
import { XUANZANG_TOKEN } from "@renderer/interfaces/xuan-zang.interface";
import { XuanzangService } from "@renderer/services/xuanzang";
import { DuRuHuiService } from "@renderer/services/duruhui";
import { QiZouRouter } from "./router";

import { loggers } from "@common/logger";
const logger = loggers.lishiming;

/**
 * 李世民服务（LisshimingService）- 大唐朝廷总管
 *
 * 职责：
 * 1. 统筹朝廷百官就任（服务初始化与依赖注入）
 * 2. 建立启奏-圣旨系统（qizou-shengzhi架构）
 * 3. 开启贞观之治（应用生命周期管理）
 *
 * 架构关系：
 * ```
 *                            👑 李世民（中央协调者）
 *                                    |
 *                    +---------------+---------------+
 *                    |                               |
 *            📋 杜如晦（通道管理）          🔀 QiZouRouter（路由决策）
 *                    |                               |
 *        +-----------+-----------+         监听 mitt.on('qizou')
 *        |           |           |                   |
 *   褚遂良通道  尉迟恭通道  [更多]         根据 event-routing.yml
 *        |           |                               |
 *   [port1]     [port1]                    委托杜如晦下旨
 *        ↓           ↓                               ↓
 *   褚遂良      尉迟恭                    issueShengzhi()
 *   [port2]     [port2]
 *        |           |
 *   接收圣旨    接收圣旨
 *        |           |
 *   执行任务    执行任务
 *        |           |
 *   mitt.emit   mitt.emit
 *   ('qizou')   ('qizou')
 *        |           |
 *        +-----+-----+
 *              ↓
 *      李世民路由器监听
 * ```
 *
 * @class LisshimingService
 * @implements {ILisshimingService}
 * @since RFC 0038 Phase 7 - qizou-shengzhi架构
 * @date 2025-10-16
 */
export class LisshimingService implements ILisshimingService {
    /** 袁天罡服务 - 钦天监（IPC事件监听） */
    private yuanTianGangService!: YuanTianGangService;

    /** 房玄龄服务 - 宰相（奏折处理与天界调度） */
    private fangXuanLingService!: FangXuanLingService;

    /** 褚遂良服务 - 中书令（偏好设置管理） */
    private chuSuiLiangService!: ChusuiliangService;

    /** 尉迟恭服务 - 大将军（扫描队列UI管理） */
    private yuChiGongService!: YuChiGongService;

    /** 玄奘服务 - 法师（国际化多语言） */
    private xuanzangService!: XuanzangService;

    /** 杜如晦服务 - 中书侍郎（MessageChannel管理器） */
    private duRuHuiService!: DuRuHuiService;

    /** 启奏路由器 - 中央事件路由决策者 */
    private router!: QiZouRouter;

    /**
     * 构造函数 - 李世民登基
     * @param app Vue应用实例，用于依赖注入
     */
    constructor(private app: App) {
        logger.info("👑 李世民登基");
    }

    get isEmployed() {
        return (
            this.yuanTianGangService &&
            this.fangXuanLingService &&
            this.chuSuiLiangService &&
            this.yuChiGongService &&
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

        logger.info("👑 尉迟恭大将军服务就任");
        this.yuChiGongService = new YuChiGongService(this.fangXuanLingService);
        this.app.provide(YU_CHI_GONG_TOKEN, this.yuChiGongService);

        logger.info("👑 玄奘法师服务就任");
        this.xuanzangService = new XuanzangService(this.fangXuanLingService);
        this.app.provide(XUANZANG_TOKEN, this.xuanzangService);

        // 初始化启奏-圣旨系统
        this.initializeQizouShengzhiSystem();
    }

    /**
     * 初始化启奏-圣旨系统（qizou-shengzhi架构）
     *
     * 系统流程图：
     * ```
     * 第一步：杜如晦建立通道
     * ┌─────────────────────────────────────┐
     * │ 杜如晦创建 MessageChannel           │
     * │   褚遂良: port1(李世民) - port2(褚) │
     * │   尉迟恭: port1(李世民) - port2(尉) │
     * └─────────────────────────────────────┘
     *
     * 第二步：李世民路由器启动
     * ┌─────────────────────────────────────┐
     * │ QiZouRouter 创建 mitt 事件总线      │
     * │ 加载 event-routing.yml 路由配置    │
     * │ 注册 mitt.on('qizou') 监听器       │
     * └─────────────────────────────────────┘
     *
     * 第三步：传递启奏通道给服务
     * ┌─────────────────────────────────────┐
     * │ 褚遂良.setQizouBus(mitt)            │
     * │ 尉迟恭.setQizouBus(mitt)            │
     * └─────────────────────────────────────┘
     *
     * 运行时数据流：
     * 褚遂良完成路径添加 → mitt.emit('qizou') →
     * 李世民路由器监听 → 查找路由规则 →
     * 构建圣旨 → 委托杜如晦下旨 →
     * MessageChannel.postMessage → 尉迟恭接收圣旨 →
     * 执行扫描任务
     * ```
     *
     * @private
     * @description 建立朝廷启奏-圣旨协作系统
     */
    private initializeQizouShengzhiSystem(): void {
        logger.info("👑 初始化启奏-圣旨系统");

        // 1. 杜如晦就任，负责MessageChannel管理
        logger.info("📋 杜如晦中书侍郎就任，负责圣旨通道管理");
        this.duRuHuiService = new DuRuHuiService();

        // 2. 李世民路由器启动，负责监听qizou和路由决策
        logger.info("👑 李世民中央路由器启动");
        this.router = new QiZouRouter(this.duRuHuiService);

        // 3. 建立褚遂良与杜如晦的MessageChannel通道
        logger.info("📋 杜如晦为褚遂良建立圣旨通道");
        this.duRuHuiService.connect(this.chuSuiLiangService);

        // 4. 将qizouBus传递给褚遂良，供其发送启奏
        this.chuSuiLiangService.setQizouBus(this.router.getQizouBus());

        // 5. 建立尉迟恭与杜如晦的MessageChannel通道
        logger.info("📋 杜如晦为尉迟恭建立圣旨通道");
        this.duRuHuiService.connect(this.yuChiGongService);

        // 6. 将qizouBus传递给尉迟恭，供其发送启奏
        this.yuChiGongService.setQizouBus(this.router.getQizouBus());

        logger.info("👑 启奏-圣旨系统初始化完成");
        logger.info("👑 李世民已开始监听所有启奏事件，并根据event-routing.yml自动路由");
    }

    async startZhengguan() {
        logger.info("👑 开始启动大唐贞观之治");
        this.employ();
        // 各部门通过奏折系统初始化
        try {
            logger.info("👑 褚遂良中书令服务初始化偏好设置");
            await this.chuSuiLiangService.initializePreferences();

            logger.info("👑 玄奘法师服务初始化语言设置");
            await this.xuanzangService.initializeLocalization();
        } catch (error) {
            logger.error("👑偏好设置初始化失败，继续启动应用:", error);
        }
    }
}
