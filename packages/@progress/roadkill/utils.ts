export interface Logger {
    (message: string): void;
}

export interface Disposable {
    dispose(): void | Promise<void>;
}

export type URL = string;

/**
 * If the provided {@link signal} is a {@link number},
 * this will convert it to a {@link AbortSignal} calling {@link AbortSignal.timeout}.
 * 
 * Otherwise it will pass the original `undefined` or {@link AbortSignal}.
 */
export function start(signal: undefined | number | AbortSignal): undefined | AbortSignal {
    if (typeof signal === "number") return AbortSignal.timeout(signal);
    return signal;
}

/**
 * Returns a promise that gets resolved in {@link milliseconds}, unless cancelled by the {@link signal}.
 * 
 * Use like:
 * ```
 * await delay(2000);
 * ```
 * 
 * Or when executing within context that supports abort:
 * ```
 * async function test(signal: AbortSignal) {
 *     await delay(2000, signal);
 * }
 * ```
 */
export function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    return new Promise((resolve, reject) => {
        if (signal) {
            const abortHandler = () => {
                clearTimeout(timeout);
                reject(signal.reason);
            }
            signal?.addEventListener("abort", abortHandler);
            const timeout = setTimeout(() => {
                signal?.removeEventListener("abort", abortHandler);
                resolve();
            }, milliseconds);
        } else {
            setTimeout(resolve, milliseconds);
        }
    });
}

export function timeout(milliseconds: number): AbortSignal {
    return AbortSignal.timeout(milliseconds);
}