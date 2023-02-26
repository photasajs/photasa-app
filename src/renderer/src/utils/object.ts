import { clone } from "radash";

export function deepCopy<T>(object: T): T {
    return clone(object);
}
