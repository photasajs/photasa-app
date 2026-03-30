/**
 * 🏛️ 人界服务接口 - 标准服务契约
 *
 * 所有需要接收圣旨（shengzhi）的服务必须实现此接口
 *
 * @interface IService
 * @description 定义服务的基本能力：
 * 1. 自我标识（name）- 服务向外界声明自己的名称
 * 2. 接收圣旨通道（setShengzhiPort）- 接收来自李世民的单向圣旨
 *
 * @example
 * ```typescript
 * class ChusuiliangService implements IService {
 *     get name(): string {
 *         return "褚遂良";
 *     }
 *
 *     setShengzhiPort(port: MessagePort): void {
 *         this._shengzhiPort = port;
 *         this._shengzhiPort.onmessage = this.processShengzhi.bind(this);
 *     }
 * }
 * ```
 *
 * @since RFC 0038 Phase 7 - qizou-shengzhi架构
 * @date 2025-10-16
 */
export interface IService {
    /**
     * 服务名称标识
     *
     * @returns 服务的唯一名称（如："褚遂良"、"尉迟恭"）
     * @description
     * - 用于杜如晦（DuRuHui）创建MessageChannel时识别服务
     * - 用于李世民（LiShiMing）路由决策时匹配目标服务
     * - 必须与event-routing.yml中的service字段一致
     */
    readonly name: string;

    /**
     * 设置圣旨接收通道（单向）
     *
     * @param port MessageChannel的port2端，用于接收圣旨
     * @description
     * - 由杜如晦（DuRuHui.connect()）调用建立通道
     * - MessageChannel是**单向**的：只接收圣旨，不发送响应
     * - 服务完成任务后，应通过qizou启奏向李世民汇报
     * - 服务需监听port.onmessage接收圣旨并处理
     *
     * @example
     * ```typescript
     * setShengzhiPort(port: MessagePort): void {
     *     this._shengzhiPort = port;
     *     this._shengzhiPort.onmessage = (event: MessageEvent) => {
     *         const shengzhi: Shengzhi = event.data;
     *         this.processShengzhi(shengzhi);
     *     };
     * }
     * ```
     */
    setShengzhiPort(port: MessagePort): void;
}
