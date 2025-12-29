import { DateSources } from "@photasa/common";

/**
 * 验证日期是否有效
 * @param date 日期对象
 * @returns 是否有效
 */
export function isValidDate(date: Date | null | undefined): boolean {
    return date instanceof Date && !isNaN(date.getTime());
}

/**
 * 验证视频日期字符串是否有效
 * @param dateString 日期字符串
 * @returns 是否有效
 */
export function isValidVideoDate(dateString: string): boolean {
    if (
        !dateString ||
        dateString === "0000-00-00T00:00:00.000000Z" ||
        dateString.startsWith("1970-01-01T00:00:00") || // Unix epoch 时间通常表示设备时钟未设置
        dateString === "invalid-date"
    ) {
        return false;
    }
    return true;
}

/**
 * 安全地解析日期字符串
 * @param dateString 日期字符串
 * @returns 日期对象或null
 */
export function safeParseDate(dateString: string): Date | null {
    if (!isValidVideoDate(dateString)) {
        return null;
    }

    try {
        const date = new Date(dateString);
        return isValidDate(date) ? date : null;
    } catch (error) {
        return null;
    }
}

/**
 * 从多个时间字段中选择最佳日期
 * @param metadata 元数据对象
 * @param timeFields 时间字段优先级列表
 * @returns 最佳日期或null
 */
export function selectBestDate(metadata: any, timeFields: string[]): Date | null {
    // 检查format级别的tags
    for (const field of timeFields) {
        const time = metadata.format?.tags?.[field];
        if (time) {
            const date = safeParseDate(time);
            if (date) {
                return date;
            }
        }
    }

    // 检查stream级别的tags
    for (const stream of metadata.streams || []) {
        for (const field of timeFields) {
            const time = stream.tags?.[field];
            if (time) {
                const date = safeParseDate(time);
                if (date) {
                    return date;
                }
            }
        }
    }

    return null;
}

/**
 * 计算日期回退值
 * 当同时有创建时间和修改时间时，选择较早的日期
 * @param createdTime 文件创建时间
 * @param modifiedTime 文件修改时间（可选）
 * @param logger 可选的日志记录器
 * @returns 回退日期信息
 */
export function computeFallbackDate(
    createdTime?: Date,
    modifiedTime?: Date,
    logger?: { warn: (msg: string) => void; debug?: (msg: string) => void },
): {
    date: Date;
    source:
        | typeof DateSources.FILE_CREATED
        | typeof DateSources.FILE_MODIFIED
        | typeof DateSources.CURRENT_DATE;
} {
    // 检查创建时间和修改时间
    const isValidCreated = isValidDate(createdTime);
    const isValidModified = isValidDate(modifiedTime);

    if (isValidCreated && isValidModified) {
        // 两个时间都有效，选择较早的日期
        // 由于已经验证了有效性，这里可以安全使用
        const created = createdTime as Date;
        const modified = modifiedTime as Date;
        if (created.getTime() <= modified.getTime()) {
            logger?.debug?.(`Using file creation time (earlier): ${created.toISOString()}`);
            return { date: created, source: DateSources.FILE_CREATED };
        } else {
            logger?.debug?.(`Using file modification time (earlier): ${modified.toISOString()}`);
            return { date: modified, source: DateSources.FILE_MODIFIED };
        }
    } else if (isValidCreated) {
        // 只有创建时间有效
        const created = createdTime as Date;
        logger?.debug?.(`Using file creation time: ${created.toISOString()}`);
        return { date: created, source: DateSources.FILE_CREATED };
    } else if (isValidModified) {
        // 只有修改时间有效
        const modified = modifiedTime as Date;
        logger?.debug?.(`Using file modification time: ${modified.toISOString()}`);
        return { date: modified, source: DateSources.FILE_MODIFIED };
    }

    // 两个时间都无效，使用当前日期
    const currentDate = new Date();
    logger?.warn("No valid file dates found, using current date as fallback");
    return { date: currentDate, source: DateSources.CURRENT_DATE };
}

/**
 * 生成目标路径的日期部分 (YYYY/YYYYMMDD)
 * @param date 日期对象
 * @returns 目标路径字符串
 */
export function generateDatePath(date: Date): string {
    if (!isValidDate(date)) {
        date = new Date(); // 使用当前日期作为回退
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}/${year}${month}${day}`;
}
