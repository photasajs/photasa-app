/**
 * 判断是否在浏览器中运行
 * @returns 是否在浏览器中运行
 */
export const inBrowser = () => typeof window !== "undefined";

export const voidFn = () => {
    return;
};

/**
 * 是否支持被动事件
 */
export let supportsPassive = false;

/**
 * 是否支持被动事件
 */
if (inBrowser()) {
    try {
        const options = {};
        Object.defineProperty(options, "passive", {
            get() {
                supportsPassive = true;
            },
        });
        window.addEventListener("test-passive", voidFn, options);
    } catch (e) {
        voidFn();
    }
}

export const on = (
    target: Element | Document | Window,
    event: string,
    handler: EventListenerOrEventListenerObject,
    passive = false,
) => {
    if (inBrowser()) {
        target.addEventListener(
            event,
            handler,
            supportsPassive ? { capture: false, passive } : false,
        );
    }
};

/**
 * 移除事件监听
 * @param target 目标元素
 * @param event 事件类型
 * @param handler 事件处理函数
 */
export const off = (
    target: Element | Document | Window,
    event: string,
    handler: EventListenerOrEventListenerObject,
) => {
    if (inBrowser()) {
        target.removeEventListener(event, handler);
    }
};

// ==================== 索引计算相关函数 ====================

/**
 * 计算下一张图片的索引
 * @param currentIndex 当前索引
 * @param totalLength 图片总数
 * @param loop 是否循环
 * @returns 新索引或null（如果不能前进）
 */
export const calculateNextIndex = (
    currentIndex: number,
    totalLength: number,
    loop: boolean,
): number | null => {
    const newIndex = loop ? (currentIndex + 1) % totalLength : currentIndex + 1;

    if (!loop && newIndex > totalLength - 1) return null;

    return newIndex;
};

/**
 * 计算上一张图片的索引
 * @param currentIndex 当前索引
 * @param totalLength 图片总数
 * @param loop 是否循环
 * @returns 新索引或null（如果不能后退）
 */
export const calculatePrevIndex = (
    currentIndex: number,
    totalLength: number,
    loop: boolean,
): number | null => {
    if (currentIndex === 0) {
        if (!loop) return null;
        return totalLength - 1;
    }
    return currentIndex - 1;
};

/**
 * 验证并修正索引值
 * @param index 目标索引
 * @param length 数组长度
 * @returns 修正后的有效索引
 */
export const validateIndex = (index: number, length: number): number => {
    if (length === 0) return 0;
    return index >= length ? length - 1 : index < 0 ? 0 : index;
};

// ==================== 样式计算相关函数 ====================

/**
 * 计算光标样式
 * @param loadError 是否加载错误
 * @param moveDisabled 是否禁用移动
 * @param dragging 是否正在拖拽
 * @returns 光标样式
 */
export const calculateCursor = (
    loadError: boolean,
    moveDisabled: boolean,
    dragging: boolean,
): string => {
    if (loadError) return "default";

    if (moveDisabled) {
        return dragging ? "grabbing" : "grab";
    }

    return "move";
};

// ==================== 缩放和旋转计算函数 ====================

/**
 * 计算新的缩放比例
 * @param currentScale 当前缩放比例
 * @param zoomStep 缩放步长
 * @param direction 缩放方向
 * @param maxZoom 最大缩放
 * @param minZoom 最小缩放
 * @param maxScale 最大比例
 * @returns 新缩放比例或null（如果超出范围）
 */
export const calculateZoomScale = (
    currentScale: number,
    zoomStep: number,
    direction: "in" | "out",
    maxZoom: number,
    minZoom: number,
    maxScale: number,
): number | null => {
    const newScale = direction === "in" ? currentScale + zoomStep : currentScale - zoomStep;

    if (direction === "in" && newScale >= maxScale * maxZoom) return null;
    if (direction === "out" && newScale <= minZoom) return null;

    return newScale;
};

/**
 * 标准化旋转角度（0-359度）
 * @param deg 原始角度
 * @returns 标准化后的角度
 */
export const normalizeRotation = (deg: number): number => {
    const normalized = deg % 360;
    return Math.abs(normalized < 0 ? normalized + 360 : normalized);
};

// ==================== 事件处理判断函数 ====================

/**
 * 判断是否应该处理滚轮事件
 * @param status 状态对象
 * @param scrollDisabled 是否禁用滚动
 * @param zoomDisabled 是否禁用缩放
 * @returns 是否应该处理
 */
export const shouldHandleWheel = (
    status: {
        loadError: boolean;
        gesturing: boolean;
        loading: boolean;
        dragging: boolean;
        wheeling: boolean;
    },
    scrollDisabled: boolean,
    zoomDisabled: boolean,
): boolean => {
    return !(
        status.loadError ||
        status.gesturing ||
        status.loading ||
        status.dragging ||
        status.wheeling ||
        !scrollDisabled ||
        zoomDisabled
    );
};

/**
 * 根据键盘事件确定动作
 * @param key 按键
 * @param rtl 是否RTL模式
 * @param escDisabled 是否禁用ESC
 * @returns 动作类型
 */
export const getKeyboardAction = (
    key: string,
    rtl: boolean,
    escDisabled: boolean,
): "close" | "prev" | "next" | null => {
    if (!escDisabled && key === "Escape") return "close";
    if (key === "ArrowLeft") return rtl ? "next" : "prev";
    if (key === "ArrowRight") return rtl ? "prev" : "next";
    return null;
};

/**
 * 判断图片是否可以移动
 * @param moveDisabled 是否禁用移动
 * @param button 鼠标按钮（默认0）
 * @returns 是否可以移动
 */
export const canMoveImage = (moveDisabled: boolean, button = 0): boolean => {
    if (moveDisabled) return false;
    return button === 0; // 只允许鼠标左键
};

/**
 * 判断是否显示导航按钮
 * @param totalImages 图片总数
 * @param currentIndex 当前索引
 * @param loop 是否循环
 * @param direction 方向
 * @returns 显示状态和禁用状态
 */
export const shouldShowNavigationBtn = (
    totalImages: number,
    currentIndex: number,
    loop: boolean,
    direction: "prev" | "next",
): { show: boolean; disabled: boolean } => {
    if (totalImages <= 1) return { show: false, disabled: true };

    const isFirst = currentIndex <= 0;
    const isLast = currentIndex >= totalImages - 1;

    if (direction === "prev") {
        return { show: true, disabled: !loop && isFirst };
    } else {
        return { show: true, disabled: !loop && isLast };
    }
};

// ==================== 坐标计算函数 ====================

/**
 * 计算鼠标移动的距离
 * @param currentPos 当前位置
 * @param lastPos 上次位置
 * @returns 移动距离
 */
export const calculateMouseDelta = (
    currentPos: { x: number; y: number },
    lastPos: { x: number; y: number },
): { dx: number; dy: number } => {
    return {
        dx: currentPos.x - lastPos.x,
        dy: currentPos.y - lastPos.y,
    };
};
