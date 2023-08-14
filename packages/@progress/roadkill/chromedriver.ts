import { spawn, ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from "child_process";
import { delimiter } from "path";
import * as readline from "readline";
import { platform } from "os";

import type { WebDriverClient } from "./webdriver.js";
import type { Logger, URL, Disposable } from "./utils.js";

export interface ChromeDriverOptions {
    /**
     * Path to the chromedriver executable.
     * By default is `chromedriver` for MacOS and Linux, `chromedriver.exe` for Windows,
     * and the folder containing the ChromeDriver executable is expected to be in PATH.
     */
    executable?: string;

    /**
     * The path to the folder containing the ChromeDriver.
     * If provided, will be added to PATH when starting the ChromeDriver process.
     */
    path?: string;

    signal?: AbortSignal;

    /**
     * By default output from ChromeDriver will be sent to console.log, and prefixed by "[ChromeDriver]: ".
     * Set this options explicitly to `null` to to a custom logger implementation to stop output or redirect.
     * The custom logger will not receive the "[ChromeDriver]: " prefix on each line.
     */
    log?: null | Logger;

    /**
     * Pass additional args to the ChromeDriver executable.
     * 
     * You can specify port by adding `["--port=9999", "--enable-chrome-logs"]`]`.
     * 
     * Don't switch off logging. The underlying server-started and port detection looks output:
     * ```
     * /Starting ChromeDriver.*on port (\d*)/
     * ```
     * 
     * The default is: `["--enable-chrome-logs"]`.
     */
    args?: null | string[];
}

/**
 * A class abstracting operations with the chromedriver executable.
 * You can use this class to start a chrome [Endpoint node](https://www.w3.org/TR/webdriver2/#nodes)
 * on your local machine and consume it using a {@link WebDriverClient} with it.
 */
export class ChromeDriver implements Disposable {

    private chromedriver: undefined | ChildProcessWithoutNullStreams;

    private port: undefined | number;
    private address: undefined | URL;

    private startPromise?: Promise<URL>;
    private disposePromise?: Promise<void>;
    private startError?: Error;

    private readonly logger: Logger;
    private readonly chromedriverAbortController = new AbortController();
    private chromedriverRunningController?: AbortController;

    constructor(private readonly options?: ChromeDriverOptions) {
        this.logger = this.options && "log" in this.options
            ? this.options?.log || (() => {})
            : (line: string) => console.log(`[ChromeDriver]: ${line}`);
    }

    /**
     * After starting the ChromeDriver, gets an AbortSignal.
     * That AbortSignal is aborted when the ChromeDriver process exits.
     */
    get running(): AbortSignal {
        if (!this.chromedriverRunningController) return AbortSignal.abort(new Error("ChromeDriver not started."));
        return this.chromedriverRunningController.signal;
    }

    start(): Promise<URL> {
        if (this.startError) return Promise.reject(this.startError);
        if (this.startPromise) return this.startPromise;

        this.disposePromise = new Promise((resolveDispose) => {
            this.startPromise = new Promise((resolveStart, rejectStart) => {
                const executable = this.options?.executable ?? (platform() == "win32" ? "chromedriver.exe" : "chromedriver");
                const args = this.options && "args" in this.options
                    ? this.options?.args
                    : ["--enable-chrome-logs"];
                const shell = true;
                const signal: AbortSignal = this.options?.signal
                    ? (<any>AbortSignal).any([this.options.signal, this.chromedriverAbortController.signal])
                    : this.chromedriverAbortController.signal;
                
                const options: SpawnOptionsWithoutStdio = { shell, signal };
        
                if (this.options?.path) {
                    options.env = { ...process.env, PATH: this.options.path + delimiter + process.env.PATH };
                }
        
                this.chromedriver = spawn(executable, args, options);

                const outputHandler = (line: string) => {
                    this.logger(line);
        
                    if (this.port == undefined) {
                        const result = /Starting ChromeDriver.*on port (\d*)/.exec(line);
                        if (result) {
                            this.port = Number.parseInt(result[1]);
                        }
                    }
        
                    if (line == "ChromeDriver was started successfully.") {
                        this.address = `http://localhost:${this.port}`;
                        this.chromedriverRunningController = new AbortController();
                        resolveStart(this.address);
                    }
                };
                readline.createInterface(this.chromedriver.stdout).on("line", outputHandler);
                readline.createInterface(this.chromedriver.stderr).on("line", outputHandler);

                this.chromedriver.on("exit", (code) => {
                    this.startError = new Error(`ChromeDriver exited with code ${code}, before detecting service address.`);
                    rejectStart(this.startError);
                    resolveDispose();
                    if (this.chromedriverRunningController && !this.chromedriverAbortController.signal.aborted)
                        this.chromedriverRunningController.abort(new Error("ChromeDriver exited."));
                });

                this.chromedriver.on("error", (error: Error) => {
                    if (this.chromedriverRunningController && !this.chromedriverAbortController.signal.aborted)
                        this.chromedriverRunningController.abort(error);
                });
            });
        });

        return this.startPromise;
    }

    dispose(): Promise<void> {
        this.startError = this.startError ?? new Error("ChromeDriver already disposed!");

        if (!this.chromedriverAbortController.signal.aborted)
            this.chromedriverAbortController.abort(new Error("ChromeDriver Disposed."));

        return this.disposePromise || (this.disposePromise = Promise.resolve());
    }
}
