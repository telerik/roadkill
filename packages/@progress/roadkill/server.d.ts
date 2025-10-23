import EventEmitter from "events";
import type { ChildProcessWithoutNullStreams } from "child_process";
export type ServerState = "new" | "starting" | "abort start" | "running" | "abort running" | "disposed";
export interface ServerOptions {
    /**
     * Set to true to enable logging.
     */
    enableLogging?: boolean;
    /**
     * A console.log prefix.
     */
    logPrefix?: string;
    /**
     * A console.log implementation.
     */
    log?: (line: string) => void;
}
/**
 * A base class handling lightning up and tearing down a server.
 *
 * The node based servers all share similar workflow:
 * Collect initialization arguments and pass them to `spawn`.
 *
 * Wait for `spawn` to start a server and open up on a port, before starting up:
 *  - read the output for messages with urls where the server had started
 *  - read message indicating successful start
 *  - handle startup rejection based on output messages or premature process exit
 *
 * After the server had started:
 *  - read the output or wait for process exit
 *  - implement a dispose() method to teardown the process
 *
 * In the process, provide logging mechanism to multiplex the output together with
 * other services running in parallel or test lifecycle.
 *
 * Examples:
 *  - ChromeDriver.exe
 *  - React dev server at: `react-scripts start`
 */
export declare abstract class Server<Options extends ServerOptions> extends EventEmitter implements Disposable, AsyncDisposable {
    protected readonly options: Options;
    private _state;
    private process;
    private killed;
    private closed;
    private abortReason;
    constructor(options: Options);
    get state(): ServerState;
    set state(value: ServerState);
    get prefix(): string;
    start(signal?: AbortSignal): Promise<this>;
    protected abstract spawn(): ChildProcessWithoutNullStreams;
    protected started(): void;
    protected error(reason: Error): void;
    protected log(line: string): void;
    private onStdOut;
    private onStdErr;
    protected onLine(line: string): void;
    /**
     * Provide an error for startup failure due to closed process.
     */
    protected startingErrorOnClose(code: number): Error;
    private onClose;
    private onTreeKilled;
    /**
     * ECMAScript Explicit Resource Management implementation
     */
    [Symbol.dispose](): void;
    /**
     * ECMAScript Async Explicit Resource Management implementation
     */
    [Symbol.asyncDispose](): Promise<void>;
    /**
     * Kill the process and wait for disposal
     */
    private killProcess;
}
