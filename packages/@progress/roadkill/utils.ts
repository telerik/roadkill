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
export async function sleep(milliseconds: number, signal?: AbortSignal, overrideUseImplicitSignal?: boolean): Promise<void> {
    signal = withImplicitSignal(signal, overrideUseImplicitSignal);
    try {
        await new Promise<void>((resolve, reject) => {
            let timeout: NodeJS.Timeout;
            const onSignal = () => {
                clearTimeout(timeout);
                signal?.removeEventListener("abort", onSignal);
                reject(signal.reason);
            }
            const onTimeout = () => {
                clearTimeout(timeout);
                signal?.removeEventListener("abort", onSignal);
                resolve();
            }
            timeout = setTimeout(onTimeout, milliseconds);
            signal?.addEventListener("abort", onSignal);
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

export interface State {
    /**
     * The global implicit signal for this test or hook.
     */
    signal?: AbortSignal;
    test?: TestState;
    hook?: HookState;
}

export interface TestState {
    readonly names: ReadonlyArray<string>;
    readonly fullName: string;
    readonly testName: string;
    readonly status: "started" | "fail" | "pass";
    readonly error?: Error;
}

export interface HookState {
    readonly names: ReadonlyArray<string>;
    readonly fullName: string;
    readonly hookName: string;
    readonly status: "started" | "fail" | "pass";
    readonly error?: Error;
}

export function getState(): State {
    return {
        signal: global["@progress/roadkill/utils:signal"],
        test: global["@progress/roadkill/utils:test"],
        hook: global["@progress/roadkill/utils:hook"]
    };
}

/**
 * Formats duration given in milliseconds to user friendly string.
 * Tests run in seconds usually so for ranges:
 * 0 to 999ms - will print "XXXms"
 * 1 sec to 60 sec - will print "SS.XXX sec."
 * 60+ sec - will print "MM:SS.XXX min."
 */
export function formatDuration(duration: number) {

    const milliseconds = duration % 1000;
    const seconds = Math.floor(duration / 1000) % 60;
    const minutes = Math.floor(duration / 60000);

    let format = "";

    let printedMs = false;
    if (duration < 1000) {
        format = milliseconds.toString() + " ms.";
        printedMs = true;
    } else if (duration >= 1000 && duration < 10000) {
        if (milliseconds >= 0 && milliseconds <= 9) {
            format = "00" + milliseconds.toString();
            printedMs = true;
        } else if (milliseconds >= 10 && milliseconds <= 99) {
            format = "0" + milliseconds.toString();
            printedMs = true;
        } else {
            format = milliseconds.toString();
            printedMs = true;
        }
    } else {
        // For more than 10 seconds task, don't print milliseconds...
    }

    if (duration >= 1000) {
        if (duration >= 60000) {
            if (seconds >= 0 && seconds <= 9) {
                format = "0" + seconds.toString() + (printedMs ? "." + format : "");
            } else {
                format = seconds.toString() + (printedMs ? "." + format : "");
            }
        } else {
            format = seconds.toString() + (printedMs ? "." + format : "") + " sec.";
        }
    }

    if (duration >= 60000) {
        format = minutes.toString() + ":" + format + " min.";
    }

    return format;
}

const color = process.env.FORCE_COLOR || (!process.env.NO_COLOR);
const gray = color ? (text: string) => `\x1b[90m${text}\x1b[0m` : (text: string) => text;
const green = color ? (text: string) => `\x1b[32m${text}\x1b[0m` : (text: string) => text;
const red = color ? (text: string) => `\x1b[31m${text}\x1b[0m` : (text: string) => text;

const baseConsole = console;
global.console = Object.setPrototypeOf({
    group() {
        Step.flushSteps();
        super.group(...arguments);
    },
    log() {
        Step.flushSteps();
        super.log(...arguments);
    }
}, baseConsole);

class Step {
    private static stack: Step[] = [];

    private name: string;
    private startTime: number;
    private parent: Step;
    private children: Step[] = [];
    private beginPrinted: boolean = false;
    private timeout: NodeJS.Timeout;
    private interval: NodeJS.Timeout;
    private level: number;

    private detached: boolean = false;
    private completed: boolean = false;
    private groupEndPrinted: boolean = false;

    static push(name: string): Step {
        const step = new Step();
        step.name = name;
        step.level = Step.stack.length;
        step.parent = step.level ? Step.stack[step.level - 1] : undefined;
        if (step.parent) step.parent.children.push(step);
        step.startTime = Date.now();
        step.timeout = setTimeout(() => step.onTimeout(), 5000);
        step.interval = setInterval(() => step.onInterval(), 10000);
        Step.stack.push(step);
        return step;
    }

    static detachSteps() {
        this.flushSteps();
        while(Step.stack.length) {
            Step.stack.pop().detach();
        }
    }

    static flushSteps(to: Step = undefined) {
        if (to && Step.stack.indexOf(to) == -1) throw new Error(`Flushing a step '${step.name}' that is not on the stack.`);
        for (const step of Step.stack) {
            if (!step.beginPrinted) step.begin();
            if (step == to) break;
        }
    }

    static onInterval = () => {
        if (Step.stack.length == 0) throw new Error("Getting life-beat ticks while Step stack is empty.");
        const step = Step.stack[Step.stack.length - 1];
        if (step.beginPrinted) {

        } else {
            Step.flushSteps();
        }
    }

    onTimeout() {
        Step.flushSteps(this);
        this.timeout = undefined;
    }

    onInterval() {
        if (this.beginPrinted && this.hasNoRunningChildren) {
            if (this.detached) {
                baseConsole.log(`${red("⚠")} ${this.name}${gray(` (so far ${formatDuration(Date.now() - this.startTime)})`)}`)
            } else {
                baseConsole.groupEnd();
                baseConsole.group(`${gray("⋮")} ${this.name}${gray(` (so far ${formatDuration(Date.now() - this.startTime)})`)}`);
            }
        }
    }

    get hasNoRunningChildren(): boolean {
        return this.children.reduce((result, current) => result && current.completed, true);
    }

    begin() {
        if (this.beginPrinted) return;
        this.beginPrinted = true;
        baseConsole.group(`${gray("▾")} ${this.name} ...`);
    }

    resolve() {
        this.completed = true;
        const index = Step.stack.indexOf(this);
        if (index > -1) {
            Step.stack.splice(index, 1);
        }
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }
        if (this.beginPrinted && !this.groupEndPrinted) {
            this.groupEndPrinted = true;
            baseConsole.groupEnd();
        }
        if (!this.detached && this.parent) Step.flushSteps(this.parent);
        baseConsole.log(`${green("▪")} ${this.name}${gray(` (in ${formatDuration(Date.now() - this.startTime)})`)}`);
    }

    fail(cause: any) {
        this.completed = true;
        const index = Step.stack.indexOf(this);
        if (index > -1) {
            Step.stack.splice(index, 1);
        }
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }
        if (this.beginPrinted && !this.groupEndPrinted) {
            this.groupEndPrinted = true;
            baseConsole.groupEnd();
        }
        if (!this.detached && this.parent) Step.flushSteps(this.parent);
        baseConsole.log(`${red("✗")} ${this.name}${gray(` (in ${formatDuration(Date.now() - this.startTime)})`)}`);
    }

    detach() {
        this.detached = true;
        if (this.beginPrinted && !this.groupEndPrinted) {
            this.groupEndPrinted = true;
            baseConsole.groupEnd();
        }
        if (!this.completed) {
            baseConsole.log(`${red("⚠")} ${this.name} ...`);
        }
    }
}

interface TestEvent extends Event {
    test: TestState;
}

interface HookEvent extends Event {
    hook: HookState;
}

function handleTestEvent(event: TestEvent) {
    if (event.test.status != "started") {
        Step.detachSteps();
    }
}

function handleHookEvent(event: HookEvent) {
    if (event.hook.status != "started") {
        Step.detachSteps();
    }
}

global["@progress/roadkill/utils:test-events"]?.addEventListener("test", handleTestEvent);
global["@progress/roadkill/utils:test-events"]?.addEventListener("hook", handleHookEvent);


export async function step<T>(name: string, action: () => T | Promise<T>): Promise<T> {
    let result: T = undefined;
    const step = Step.push(name);
    try {
        result = await action();
        step.resolve();
        return result;
    } catch(cause) {
        step.fail(cause);
        throw cause;
    }
}
