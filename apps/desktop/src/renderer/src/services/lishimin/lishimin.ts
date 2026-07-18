import { ILishiminService } from "@renderer/interfaces/li-shi-min.interface";
import { App } from "vue";

import { YUAN_TIAN_GANG_TOKEN } from "@renderer/interfaces/yuan-tian-gang.interface";
import { YuanTianGangService } from "@renderer/services/yuantiangang";
import { FANG_XUAN_LING_TOKEN } from "@renderer/interfaces/fang-xuan-ling.interface";
import { FangXuanLingService } from "@renderer/services/fangxuanling";
import { CHU_SUI_LIANG_TOKEN } from "@renderer/interfaces/chu-sui-liang.interface";
import { ChusuiliangService } from "@renderer/services/chusuiliang";
import { YU_CHI_GONG_TOKEN } from "@renderer/interfaces/yu-chi-gong.interface";
import { YuChiGongService } from "@renderer/services/yuchigong";
import { WEI_ZHENG_TOKEN } from "@renderer/interfaces/wei-zheng.interface";
import { WeiZhengService } from "@renderer/services/weizheng";
import { QIN_QIONG_TOKEN } from "@renderer/interfaces/qin-qiong.interface";
import { QinQiongService } from "@renderer/services/qinqiong";
import { XUANZANG_TOKEN } from "@renderer/interfaces/xuan-zang.interface";
import { XuanzangService } from "@renderer/services/xuanzang";
import { YU_SHINAN_TOKEN } from "@renderer/interfaces/yu-shinan.interface";
import { YuShiNanService } from "@renderer/services/yushinan";
import { ZHANG_SUN_WU_JI_TOKEN } from "@renderer/interfaces/zhang-sun-wu-ji.interface";
import { ZhangSunWuJiService } from "@renderer/services/zhangsunwuji";
import { DuRuHuiService } from "@renderer/services/duruhui";
import { QiZouRouter } from "./router";

import { loggers } from "@photasa/common";
const logger = loggers.lishimin;

/**
 * 李世民服务（LishiminService）- 大唐朝廷总管
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
 * @class LishiminService
 * @implements {ILishiminService}
 * @since RFC 0038 Phase 7 - qizou-shengzhi架构
 * @date 2025-10-16
 */
export class LishiminService implements ILishiminService {
    /** 袁天罡服务 - 钦天监（IPC事件监听） */
    private yuanTianGangService!: YuanTianGangService;

    /** 房玄龄服务 - 宰相（奏折处理与天界调度） */
    private fangXuanLingService!: FangXuanLingService;

    /** 褚遂良服务 - 中书令（偏好设置管理） */
    private chuSuiLiangService!: ChusuiliangService;

    /** 尉迟恭服务 - 大将军（扫描队列UI管理） */
    private yuChiGongService!: YuChiGongService;

    /** 魏征服务 - 谏议大夫（appState监察） */
    private weiZhengService!: WeiZhengService;

    /** 秦琼服务 - 守门大将（文件系统事件守护者） */
    private qinQiongService!: QinQiongService;

    /** 玄奘服务 - 法师（国际化多语言） */
    private xuanzangService!: XuanzangService;

    /** 虞世南服务 - 秘书监（扫描进度展示） */
    private yuShiNanService!: YuShiNanService;

    /** 长孙无忌服务 - 司空（菜单规范管理） */
    private zhangSunWuJiService!: ZhangSunWuJiService;

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
            this.weiZhengService &&
            this.qinQiongService &&
            this.xuanzangService &&
            this.yuShiNanService &&
            this.zhangSunWuJiService
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

        logger.info("👑 魏征谏议大夫服务就任");
        this.weiZhengService = new WeiZhengService(this.fangXuanLingService);
        this.app.provide(WEI_ZHENG_TOKEN, this.weiZhengService);

        logger.info("👑 秦琼守门大将服务就任");
        this.qinQiongService = new QinQiongService();
        this.app.provide(QIN_QIONG_TOKEN, this.qinQiongService);

        logger.info("👑 玄奘法师服务就任");
        this.xuanzangService = new XuanzangService(this.fangXuanLingService);
        this.app.provide(XUANZANG_TOKEN, this.xuanzangService);

        logger.info("👑 虞世南秘书监服务就任");
        this.yuShiNanService = new YuShiNanService(this.fangXuanLingService);
        this.app.provide(YU_SHINAN_TOKEN, this.yuShiNanService);

        logger.info("👑 长孙无忌司空服务就任");
        this.zhangSunWuJiService = new ZhangSunWuJiService(this.fangXuanLingService);
        this.app.provide(ZHANG_SUN_WU_JI_TOKEN, this.zhangSunWuJiService);

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

        // 2.5. 将 qizouBus 传递给杜如晦，供其监听百姓上书 DOM 事件
        this.duRuHuiService.setQizouBus(this.router.getQizouBus());

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

        // 7. 建立魏征与杜如晦的MessageChannel通道
        logger.info("📋 杜如晦为魏征建立圣旨通道");
        this.duRuHuiService.connect(this.weiZhengService);

        // 8. 将qizouBus传递给魏征，供其发送启奏
        this.weiZhengService.setQizouBus(this.router.getQizouBus());

        // 9. 建立秦琼与杜如晦的MessageChannel通道
        logger.info("📋 杜如晦为秦琼建立圣旨通道");
        this.duRuHuiService.connect(this.qinQiongService);

        // 10. 将qizouBus传递给秦琼，供其发送启奏
        this.qinQiongService.setQizouBus(this.router.getQizouBus());

        // 11. 建立袁天罡与杜如晦的MessageChannel通道（✅ RFC 0058: 袁天罡实现 IService，需要接收圣旨）
        logger.info("📋 杜如晦为袁天罡建立圣旨通道");
        this.duRuHuiService.connect(this.yuanTianGangService);

        // 12. 将qizouBus传递给袁天罡，供其发送启奏（用于千里眼扫描完成事件）
        this.yuanTianGangService.setQizouBus(this.router.getQizouBus());

        // 13. 建立虞世南与杜如晦的MessageChannel通道
        logger.info("📋 杜如晦为虞世南建立圣旨通道");
        this.duRuHuiService.connect(this.yuShiNanService);

        // 14. 建立长孙无忌与杜如晦的MessageChannel通道
        logger.info("📋 杜如晦为长孙无忌建立圣旨通道");
        this.duRuHuiService.connect(this.zhangSunWuJiService);

        // 15. 将qizouBus传递给长孙无忌，供其发送启奏
        this.zhangSunWuJiService.setQizouBus(this.router.getQizouBus());

        logger.info("👑 启奏-圣旨系统初始化完成");
        logger.info("👑 李世民已开始监听所有启奏事件，并根据event-routing.yml自动路由");
    }

    async startZhengguan() {
        logger.info("👑 开始启动大唐贞观之治");
        this.employ();
        // 各部门通过奏折系统初始化
        try {
            logger.info("👑 杜如晦中书侍郎服务初始化百姓上书言路");
            this.duRuHuiService.initializeBaiXingShangshuYanLu();

            logger.info("👑 褚遂良中书令服务初始化偏好设置");
            await this.chuSuiLiangService.initializePreferences();

            logger.info("👑 玄奘法师服务初始化语言设置");
            await this.xuanzangService.initializeLocalization();

            logger.info("👑 魏征谏议大夫服务初始化应用状态");
            await this.weiZhengService.initializeAppState();

            logger.info("👑 尉迟恭大将军服务初始化扫描队列");
            await this.yuChiGongService.initializeScanningQueue();

            logger.info("👑 虞世南秘书监服务初始化日志拦截器");
            this.yuShiNanService.initializeLogInterceptor();
        } catch (error) {
            logger.error("👑初始化失败，继续启动应用:", error);
        }
    }
}
