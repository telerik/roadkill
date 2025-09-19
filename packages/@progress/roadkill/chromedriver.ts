import { spawn, ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from "child_process";
import { delimiter } from "path";
import { URL } from "./utils.js";
import { platform } from "os";
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

export class ChromeDriver extends Server<ChromeDriverOptions> {

    private _port: undefined | number;
    private _address: undefined | URL;

    private startupLine: string[] = [];
    
    public override get prefix() { return this.options?.logPrefix ?? "ChromeDriver" }
    public get address() { return this._address; }

    protected spawn(): ChildProcessWithoutNullStreams {
        const executable = this.options?.executable ?? (platform() == "win32" ? "chromedriver.exe" : "chromedriver");
        const args = this.options && "args" in this.options
            ? this.options?.args
            : ["--enable-chrome-logs"];
        const shell = true;

        const options: SpawnOptionsWithoutStdio = { shell };

        if (this.options?.path) {
            options.env = { ...process.env, PATH: this.options.path + delimiter + process.env.PATH };
        }

        return spawn(executable, args, options);
    }

    protected override onLine(line: string): void {
        super.onLine(line);

        if (this.state !== "starting") return;

        const l = line.trim();

        // Capture port if present anywhere in the line
        if (this._port === undefined) {
            const m = /on port\s+(\d+)/i.exec(l);
            if (m) this._port = Number.parseInt(m[1], 10);
        }

        // Transition to running when success message appears (with or without "on port ...")
        if (/ChromeDriver was started successfully/i.test(l)) {
            if (!this._address) {
                const port = this._port ?? 9515; // fall back to known port if not parsed yet
                this._address = `http://localhost:${port}`;
            }
            this.started(); // <-- this sets state = "running" when in "starting"
        }

        this.startupLine.push(l);
    }

    protected override startingErrorOnClose(code: number): Error {
        if (this.startupLine.length) {
            return new Error(`ChromeDriver failed to start. Code ${code}.\n\n${this.startupLine.join("\n")}`);
        } else {
            return new Error(`ChromeDriver failed to start. Code ${code}.`);
        }
    }
}
