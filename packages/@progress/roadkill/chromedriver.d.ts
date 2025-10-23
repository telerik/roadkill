import { ChildProcessWithoutNullStreams } from "child_process";
import { Server, ServerOptions } from "./server.js";
export interface ChromeDriverOptions extends ServerOptions {
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
    /**
     * Set to true to enable logging for ChromeDriver.
     */
    enableLogging?: boolean;
    /**
     * A console.log prefix for the ChromeDriver.
     * Default is `[ChromeDriver] `.
     */
    logPrefix?: string;
}
export declare class ChromeDriver extends Server<ChromeDriverOptions> {
    private _port;
    private _address;
    private startupLine;
    get prefix(): string;
    get address(): string;
    protected spawn(): ChildProcessWithoutNullStreams;
    protected onLine(line: string): void;
    protected startingErrorOnClose(code: number): Error;
}
