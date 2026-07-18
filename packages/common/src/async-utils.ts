/**
 * 通用异步工具库
 * 提供promisified的异步操作工具函数
 */

/**
 * 创建一个基于setTimeout的Promise
 * @param delay 延迟时间（毫秒）
 * @param value 可选的值，将在延迟后resolve
 * @returns Promise，在指定时间后resolve
 *
 * @example
 * ```typescript
 * // 等待1秒
 * await timeout(1000);
 *
 * // 等待500毫秒并返回结果
 * const result = await timeout(500, "Hello");
 * ```
 */
export function timeout<T = void>(delay: number, value?: T): Promise<T> {
    return new Promise<T>((resolve) => {
        setTimeout(() => resolve(value as T), delay);
    });
}

/**
 * 等待下一个动画帧
 * @param value 可选的值，将在下一帧后resolve
 * @returns Promise，在下一帧后resolve
 *
 * @example
 * ```typescript
 * // 等待下一帧
 * await nextFrame();
 *
 * // 等待下一帧并返回结果
 * const result = await nextFrame("Frame ready");
 * ```
 */
export function nextFrame<T = void>(value?: T): Promise<T> {
    return new Promise<T>((resolve) => {
        requestAnimationFrame(() => resolve(value as T));
    });
}

/**
 * 创建一个可取消的timeout
 * @param delay 延迟时间（毫秒）
 * @param value 可选的值，将在延迟后resolve
 * @returns 包含Promise和cancel函数的对象
 *
 * @example
 * ```typescript
 * const { promise, cancel } = cancellableTimeout(1000, "Done");
 *
 * // 取消timeout
 * cancel();
 *
 * // 等待结果
 * const result = await promise;
 * ```
 */
export function cancellableTimeout<T = void>(
    delay: number,
    value?: T,
): {
    promise: Promise<T>;
    cancel: () => void;
} {
    let timeoutId = null as NodeJS.Timeout | null;
    let isCancelled = false;

    const promise = new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => {
            if (!isCancelled) {
                resolve(value as T);
            }
        }, delay);
    });

    const cancel = () => {
        isCancelled = true;
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };

    return { promise, cancel };
}

/**
 * 创建一个可取消的nextFrame
 * @param value 可选的值，将在下一帧后resolve
 * @returns 包含Promise和cancel函数的对象
 *
 * @example
 * ```typescript
 * const { promise, cancel } = cancellableNextFrame("Frame ready");
 *
 * // 取消
 * cancel();
 *
 * // 等待结果
 * const result = await promise;
 * ```
 */
export function cancellableNextFrame<T = void>(
    value?: T,
): {
    promise: Promise<T>;
    cancel: () => void;
} {
    let animationFrameId = null as number | null;
    let isCancelled = false;

    const promise = new Promise<T>((resolve) => {
        animationFrameId = requestAnimationFrame(() => {
            if (!isCancelled) {
                resolve(value as T);
            }
        });
    });

    const cancel = () => {
        isCancelled = true;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    };

    return { promise, cancel };
}

/**
 * 等待多个条件之一满足
 * @param conditions 条件函数数组
 * @param timeout 超时时间（毫秒），默认5000ms
 * @returns Promise，当任一条件满足时resolve
 *
 * @example
 * ```typescript
 * const result = await waitForAny([
 *   () => document.readyState === 'complete',
 *   () => window.someGlobalVar !== undefined
 * ], 3000);
 * ```
 */
export function waitForAny(conditions: (() => boolean)[], timeout = 5000): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const checkConditions = () => {
            if (conditions.some((condition) => condition())) {
                resolve(true);
                return;
            }

            if (Date.now() - startTime >= timeout) {
                reject(new Error(`waitForAny timeout after ${timeout}ms`));
                return;
            }

            requestAnimationFrame(checkConditions);
        };

        checkConditions();
    });
}

/**
 * 等待所有条件都满足
 * @param conditions 条件函数数组
 * @param timeout 超时时间（毫秒），默认5000ms
 * @returns Promise，当所有条件都满足时resolve
 *
 * @example
 * ```typescript
 * const result = await waitForAll([
 *   () => document.readyState === 'complete',
 *   () => window.someGlobalVar !== undefined
 * ], 3000);
 * ```
 */
export function waitForAll(conditions: (() => boolean)[], timeout = 5000): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const checkConditions = () => {
            if (conditions.every((condition) => condition())) {
                resolve(true);
                return;
            }

            if (Date.now() - startTime >= timeout) {
                reject(new Error(`waitForAll timeout after ${timeout}ms`));
                return;
            }

            requestAnimationFrame(checkConditions);
        };

        checkConditions();
    });
}
