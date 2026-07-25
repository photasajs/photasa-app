/** 固定行高虚拟列表：判断 index 是否完整落在滚动视口内 */
export function isFixedItemIndexInScrollViewport(params: {
    index: number;
    itemHeight: number;
    scrollTop: number;
    viewportHeight: number;
}): boolean {
    const { index, itemHeight, scrollTop, viewportHeight } = params;
    if (viewportHeight <= 0 || itemHeight <= 0 || index < 0) {
        return false;
    }

    const itemTop = index * itemHeight;
    const itemBottom = itemTop + itemHeight;
    const viewBottom = scrollTop + viewportHeight;

    return itemTop >= scrollTop && itemBottom <= viewBottom;
}

/** 将滚动容器恢复到指定 offset（多次 apply 对抗虚拟列表异步重排） */
export function restoreScrollContainerOffset(
    container: HTMLElement,
    offset: number,
    applyVirtualizerOffset?: (offset: number) => void,
): void {
    const top = Math.max(0, offset);
    const apply = (): void => {
        container.scrollTop = top;
        applyVirtualizerOffset?.(top);
    };

    apply();
    if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => {
            apply();
            requestAnimationFrame(apply);
        });
    }
}

/** 非虚拟树：节点是否完整落在滚动容器视口内 */
export function isElementInScrollContainer(element: Element, container: Element): boolean {
    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    return (
        elementRect.top >= containerRect.top &&
        elementRect.bottom <= containerRect.bottom &&
        elementRect.left >= containerRect.left &&
        elementRect.right <= containerRect.right
    );
}
