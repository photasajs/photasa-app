/**
 * EXIF utility functions for consistent date extraction across different processors
 */

/**
 * EXIF date field priority order
 */
export const EXIF_DATE_FIELDS = ["DateTimeDigitized", "DateTimeOriginal", "DateTime"] as const;

/**
 * Represents an EXIF tag that can have different data structures
 */
export interface ExifTag {
    value?: string[] | string;
    description?: string;
}

/**
 * EXIF tags structure that can contain date fields
 * Using any to be compatible with ExifReader's Tags type
 */
export interface ExifTags {
    [key: string]: any;
}

/**
 * Extracts date string from an EXIF tag, handling different data structures
 * @param dateTag - The EXIF tag containing date information
 * @returns The date string or null if not found
 */
export function extractDateStringFromTag(dateTag: any): string | null {
    if (!dateTag) {
        return null;
    }

    // Handle direct string format
    if (typeof dateTag === "string") {
        return dateTag;
    }

    // Handle object format with value array
    if (dateTag.value && Array.isArray(dateTag.value) && dateTag.value[0]) {
        return dateTag.value[0];
    }

    // Handle object format with description
    if (dateTag.description) {
        return dateTag.description;
    }

    return null;
}

/**
 * Extracts timezone offset string from EXIF OffsetTime tag
 * @param offsetTag - The EXIF OffsetTime tag
 * @returns The timezone offset string or null if not found
 */
export function extractTimezoneOffset(offsetTag: any): string | null {
    return extractDateStringFromTag(offsetTag);
}

/**
 * Normalizes EXIF date string from "YYYY:MM:DD HH:mm:ss" to "YYYY-MM-DD HH:mm:ss"
 * @param dateStr - The EXIF date string
 * @returns The normalized date string
 */
export function normalizeExifDateString(dateStr: string): string {
    return dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
}

/**
 * Extracts and parses a date from EXIF tags for a specific field
 * @param tags - The EXIF tags object
 * @param field - The EXIF date field to extract
 * @param debug - Optional debug flag for detailed logging
 * @returns A Date object or null if extraction/parsing fails
 */
export function extractDateTimeFromExifField(tags: any, field: string, debug = false): Date | null {
    if (!tags || !tags[field]) {
        if (debug) {
            console.debug(
                `[EXIF Debug] Field '${field}' not found in tags:`,
                Object.keys(tags || {})
                    .slice(0, 10)
                    .join(", "),
            );
        }
        return null;
    }

    const dateStr = extractDateStringFromTag(tags[field]);
    if (!dateStr) {
        if (debug) {
            console.debug(
                `[EXIF Debug] No date string extracted from field '${field}':`,
                tags[field],
            );
        }
        return null;
    }

    if (debug) {
        console.debug(`[EXIF Debug] Extracted date string from '${field}': "${dateStr}"`);
    }

    try {
        // Normalize the date string format
        const normalizedDateStr = normalizeExifDateString(dateStr);
        if (debug && normalizedDateStr !== dateStr) {
            console.debug(`[EXIF Debug] Normalized date string: "${normalizedDateStr}"`);
        }

        // Handle timezone offset if present
        let finalDateStr = normalizedDateStr;
        const offsetStr = extractTimezoneOffset(tags.OffsetTime);
        if (offsetStr) {
            finalDateStr += offsetStr;
            if (debug) {
                console.debug(`[EXIF Debug] Applied timezone offset: "${finalDateStr}"`);
            }
        }

        const date = new Date(finalDateStr);

        // Validate the date
        if (!isNaN(date.getTime())) {
            if (debug) {
                console.debug(`[EXIF Debug] Successfully parsed date: ${date.toISOString()}`);
            }
            return date;
        } else {
            if (debug) {
                console.debug(`[EXIF Debug] Invalid date result from: "${finalDateStr}"`);
            }
        }
    } catch (error) {
        if (debug) {
            console.debug(`[EXIF Debug] Error parsing date "${dateStr}": ${error}`);
        }
        return null;
    }

    return null;
}

/**
 * Extracts date from EXIF tags using field priority order
 * @param tags - The EXIF tags object
 * @param fields - Array of field names to try in order (defaults to EXIF_DATE_FIELDS)
 * @param debug - Optional debug flag for detailed logging
 * @returns A Date object or null if no valid date is found
 */
export function extractDateTimeFromExif(
    tags: any,
    fields: readonly string[] = EXIF_DATE_FIELDS,
    debug = false,
): Date | null {
    if (!tags) {
        if (debug) {
            console.debug("[EXIF Debug] No tags provided");
        }
        return null;
    }

    if (debug) {
        console.debug(
            `[EXIF Debug] Available EXIF tags:`,
            Object.keys(tags).slice(0, 20).join(", "),
        );
        console.debug(`[EXIF Debug] Trying date fields in order:`, fields);
    }

    for (const field of fields) {
        const result = extractDateTimeFromExifField(tags, field, debug);
        if (result) {
            if (debug) {
                console.debug(
                    `[EXIF Debug] Successfully found date from field '${field}': ${result.toISOString()}`,
                );
            }
            return result;
        }
    }

    if (debug) {
        console.debug("[EXIF Debug] No valid date found in any field");
    }
    return null;
}

/**
 * Legacy function name for backward compatibility
 * @deprecated Use extractDateTimeFromExif instead
 */
export const extractDateTimeUnified = extractDateTimeFromExif;
