import type { Position } from "@renderer/types/position";

export function getPosition(target: HTMLElement): Position {
    let xPosition = 0;
    let yPosition = 0;

    let element = target;

    while (element != null) {
        xPosition += element.offsetLeft - element.scrollLeft + element.clientLeft;
        yPosition += element.offsetTop - element.scrollTop + element.clientTop;
        element = <HTMLElement>element.offsetParent;
    }

    return { x: xPosition, y: yPosition };
}
