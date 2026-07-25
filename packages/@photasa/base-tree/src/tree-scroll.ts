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
