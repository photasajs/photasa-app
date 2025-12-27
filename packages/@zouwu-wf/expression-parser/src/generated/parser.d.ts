export function parse(input: string, options?: any): any;

export class SyntaxError extends Error {
    location: LocationRange;
    found: any;
    expected: any[];
    format(sources: any[]): string;
}

export interface LocationRange {
    start: Location;
    end: Location;
}

export interface Location {
    offset: number;
    line: number;
    column: number;
}
