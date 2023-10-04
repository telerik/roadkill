export interface Logger {
    (message: string): void;
}

export interface Disposable {
    dispose(): void | Promise<void>;
}

export type URL = string;

/**
 * Returns a promise that gets resolved in {@link milliseconds}, unless cancelled by the {@link signal}.
 */
export async function delay(milliseconds: number, signal?: AbortSignal, overrideUseImplicitSignal?: boolean): Promise<void> {
    signal = withImplicitSignal(signal, overrideUseImplicitSignal);
    try {
        await new Promise((resolve, reject) => {
            signal?.addEventListener("abort", () => reject(signal.reason));
            setTimeout(resolve, milliseconds);
        });
    } catch(cause) {
        throw new Error("Delay was aborted.", { cause });
    }
}

export function timeout(milliseconds: number): AbortSignal {
    return AbortSignal.timeout(milliseconds);
}

let _useImplicitSignal = true;

/**
 * Set to true to enable applying global implicit signals.
 * If set to false, {@link withImplicitSignal} will be disabled and will 
 */
export function useImplicitSignal(mode: boolean) {
    _useImplicitSignal = mode;
}

/**
 * Test frameworks can set global["@progress/roadkill/utils:signal"] to an implicit signal.
 * This method will merge the {@link signal} with the implicit global test signal.
 * 
 * {@see useGlobalSignal} to disable that behavior.
 * 
 * {@link overrideUseImplicitSignal} if undefined, the method will use whatever is globally set in {@link useImplicitSignal}.
 * {@link overrideUseImplicitSignal} if true or false, will override the global settings in {@link useImplicitSignal}.
 */
export function withImplicitSignal(signal?: AbortSignal, overrideUseImplicitSignal?: boolean): undefined | AbortSignal {
    const useImplicit = overrideUseImplicitSignal ?? _useImplicitSignal;
    if (!useImplicit) return signal;
    const globalSignal = global["@progress/roadkill/utils:signal"] as AbortSignal;
    if (signal && globalSignal) return (AbortSignal as any).any([signal, globalSignal]);
    return globalSignal ?? signal;
}

export interface TestState {
    /**
     * The global implicit signal for this test or hook.
     */
    signal?: AbortSignal;

    testSignal?: AbortSignal;
    hookSignal?: AbortSignal;
    testFullName?: string;
    testShortName?: string;
    testNameChain?: string[];

    testState?: "pass" | "fail";
}

export function getState(): TestState {
    return {
        signal: global["@progress/roadkill/utils:signal"]
    };
}