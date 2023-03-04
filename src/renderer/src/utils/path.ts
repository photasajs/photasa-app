import { trim } from "radash";

export function normalizePath(path: string): string {
    // regex to append slash to the end of the path
    return mergePath(path, "");
}

export function mergePath(left: string, right = ""): string {
    return `/${trim(left, "/")}/${trim(right, "/")}`;
}
