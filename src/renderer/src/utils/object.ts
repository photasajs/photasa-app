import { clone } from "radash";

export function deepCopy<T>(object: T): T {
    return clone(object);
}

export function top<T>(array): T {
    return Array.isArray(array) ? array[array.length - 1] : undefined;
}
