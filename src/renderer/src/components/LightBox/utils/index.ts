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
