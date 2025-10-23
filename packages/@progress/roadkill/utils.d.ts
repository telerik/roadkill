export interface Logger {
    (message: string): void;
}
export type URL = string;
/**
 * Returns a promise that gets resolved in {@link milliseconds}, unless cancelled by the {@link signal}.
 */
export declare function sleep(milliseconds: number, signal?: AbortSignal): Promise<void>;
export declare function timeout(milliseconds: number): AbortSignal;
/**
 * Formats duration given in milliseconds to user friendly string.
 * Tests run in seconds usually so for ranges:
 * 0 to 999ms - will print "XXXms"
 * 1 sec to 60 sec - will print "SS.XXX sec."
 * 60+ sec - will print "MM:SS.XXX min."
 */
export declare function formatDuration(duration: number): string;
export declare function step<T>(name: string, action: () => T | Promise<T>): Promise<T>;
