import { isObject } from "@renderer/common/object";
import { isString } from "@renderer/common/string";
import type { Img } from "./types";

/**
 * 判断是否为图片对象
 * @param arg 图片对象
 * @returns 是否为图片对象
 */
export function isImg(arg: Img): arg is Img {
    return isObject(arg) && isString(arg.src);
}

/**
 * 处理拖拽事件的选项
 * @param onNext 下一页的回调
 * @param onPrev 上一页的回调
 * @param canMove 是否可以移动
 * @param imgWrapperState 图片包裹状态
 * @param swipeTolerance 拖拽容忍度
 */
export type MutateDraggingOptions = {
    onNext: () => void;
    onPrev: () => void;
    canMove: () => boolean;
    imgWrapperState: {
        lastX: number;
        lastY: number;
        initX: number;
        initY: number;
    };
    swipeTolerance: number;
};

/**
 * 处理拖拽事件
 * @param newStatus 新的状态
 * @param oldStatus 旧的状态
 * @param {Object} options 选项
 * @param {Function} options.onNext 下一页的回调
 * @param {Function} options.onPrev 上一页的回调
 * @param {Function} options.canMove 是否可以移动
 * @param {Object} options.imgWrapperState 图片包裹状态
 * @param {number} options.swipeTolerance 拖拽容忍度
 */
export const mutateDragging = (
    newStatus,
    oldStatus,
    { onNext, onPrev, canMove, imgWrapperState, swipeTolerance }: MutateDraggingOptions,
) => {
    const dragged = !newStatus && oldStatus;

    if (!canMove() && dragged) {
        const xDiff = imgWrapperState.lastX - imgWrapperState.initX;
        const yDiff = imgWrapperState.lastY - imgWrapperState.initY;

        const tolerance = swipeTolerance;
        const movedHorizontally = Math.abs(xDiff) > Math.abs(yDiff);

        if (movedHorizontally) {
            if (xDiff < tolerance * -1) onNext();
            else if (xDiff > tolerance) onPrev();
        }
    }
};
