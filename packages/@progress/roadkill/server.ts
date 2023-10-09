import EventEmitter from "events";
import { Disposable, withImplicitSignal } from "./utils.js";
import type { ChildProcessWithoutNullStreams } from "child_process";
import treeKill from "tree-kill";
import * as readline from "readline";

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
export abstract class Server<Options extends ServerOptions> extends EventEmitter implements Disposable  {

    private _state: ServerState = "new";

    private process: ChildProcessWithoutNullStreams;

    private killed = false;
    private closed = false;
    private abortReason: any;

    constructor(protected readonly options: Options) {
        super();
    }

    get state(): ServerState { return this._state; }
    set state(value: ServerState) {
        if (this._state == value) return;
        this._state = value;
        switch (value) {
            case "starting":
                this.log("Starting...");
                break;
            case "running":
                this.log("Running.");
                break;
            case "disposed":
                this.log("Disposed.");
                break;
        }
        this.emit("state", value);
    }

    public get prefix() { return this.options?.logPrefix ?? "Server" }

    public async start(signal?: AbortSignal, useImplicitSignal?: boolean) {
        if (this.state != "new") throw new Error("Can only start once.");
        this.state = "starting";

        try {
            signal = withImplicitSignal(signal, useImplicitSignal);
            signal?.throwIfAborted();

            this.process = this.spawn();
            if (!this.process) throw new Error("Process spawn didn't return a process.");

        } catch(error) {
            this.state = "disposed";
            throw error;
        }
        
        signal?.addEventListener("abort", () => this.error(signal.reason));
        readline.createInterface(this.process.stdout).on("line", this.onStdOut.bind(this));
        readline.createInterface(this.process.stderr).on("line", this.onStdErr.bind(this));
        this.process.on("close", (code) => this.onClose(code));

        await new Promise<void>((resolve, reject) => {
            this.on("state", (value: ServerState) => {
                if (value == "running") resolve();
                if (value == "disposed") reject(this.abortReason);
            });
        });

        return this;
    }

    protected abstract spawn(): ChildProcessWithoutNullStreams;

    protected started() {
        if (this.state == "starting") {
            this.state = "running";
        }
    }

    protected error(reason: Error) {
        if (this.state == "starting") {
            this.state = "abort start";
            this.log(`Abort start. Reason: ${reason}`);
            this.abortReason = reason;
            treeKill(this.process.pid, this.onTreeKilled.bind(this));
        } else if (this.state == "running") {
            this.state = "abort running";
            this.log(`Abort running. Reason: ${reason}`);
            this.abortReason = reason;
            treeKill(this.process.pid, this.onTreeKilled.bind(this));
        }
    }

    protected log(line: string) {
        if (this.options.enableLogging) console.log(`${this.prefix ? "[" + this.prefix + "] " : ""}${line}`);
    }

    private onStdOut(line: string) {
        this.onLine(line);
        this.log(`stdout: ${line}`);
    }

    private onStdErr(line: string) {
        this.onLine(line);
        this.log(`stderr: ${line}`);
    }

    protected onLine(line: string) {}

    /**
     * Provide an error for startup failure due to closed process.
     */
    protected startingErrorOnClose(code: number): Error {
        return new Error(`Process closed during startup. Code ${code}.`);
    }

    private onClose(code: number) {
        this.log("Process closed.");
        this.closed = true;
        if (this.state == "starting") {
            this.abortReason = this.startingErrorOnClose(code);
            this.state = "disposed";
        } else if (this.state == "abort start") {
            if (this.closed && this.killed) {
                this.state = "disposed";
            }
        } else if (this.state == "running") {
            this.state = "disposed";
        } else if (this.state == "abort running") {
            if (this.closed && this.killed) {
                this.state = "disposed";
            }
        }
    }

    private onTreeKilled(error?: Error) {
        this.log("Process tree killed.");
        this.killed = true;
        if (this.state == "abort start") {
            if (this.closed && this.killed) {
                this.state = "disposed";
            }
        }
    }

    public async dispose(): Promise<void> {
        if (this.state == "new") {
            this.state = "disposed";
        } if (this.state == "starting") {
            this.error(new Error("Disposed while starting."));
        } else if (this.state == "running") {
            this.state = "abort running";
            this.abortReason = new Error("Dispose...");
            this.log(`Dispose...`);
            treeKill(this.process.pid, this.onTreeKilled.bind(this));
        }

        if (this.state != "disposed") {
            await new Promise<void>(resolve => {
                this.on("state", (state: ServerState) => {
                    if (this.state == "disposed") resolve();
                })
            });
        }
    }
}
