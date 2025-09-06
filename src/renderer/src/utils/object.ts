import { clone } from "radash";

export function deepCopy<T>(object: T): T {
    return clone(object);
}

export function top<T>(array: T[]): T {
    return Array.isArray(array) ? array[array.length - 1] : (null as T);
}

/**
 * Get the next scan item from array based on priority and timestamp
 * @param array Array of scan items with optional priority and createdAt fields
 * @returns Next item to process (highest priority, then earliest timestamp)
 */
export function getNextScanItem<T extends { createdAt?: number; priority?: number }>(
    array: T[],
): T | null {
    if (!Array.isArray(array) || array.length === 0) {
        return null;
    }

    // Sort by priority first (lower number = higher priority), then by createdAt (earlier = higher priority)
    const sortedArray = [...array].sort((a, b) => {
        const priorityA = a.priority ?? 999;
        const priorityB = b.priority ?? 999;

        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }

        const timeA = a.createdAt ?? 0;
        const timeB = b.createdAt ?? 0;
        return timeA - timeB; // Earlier timestamp first
    });

    return sortedArray[0];
}
