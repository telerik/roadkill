import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from "child_process";
import { delimiter } from "node:path";
import { Server, type ServerOptions } from "./server.js";

export interface ExpressOptions extends ServerOptions {
    /** Working directory for the process. Defaults to process.cwd(). */
    cwd?: string;

    /** Command to start the server (e.g., "npm", "node"). */
    command: string;

    /** Arguments for the command. */
    args: string[];

    /** Additional environment variables for the process. */
    env?: NodeJS.ProcessEnv;

    /** Additional PATH entries (prepended). */
    pathPrepend?: string[];

    /** Fallback port if no address is parsed. Defaults to 3000. */
    defaultPort?: number;

    /** Regex to detect readiness in stdout. */
    readinessRegex?: RegExp;

    /** Regex to extract the address from stdout. */
    addressRegex?: RegExp;

    /** Entry file for node-ts helper. Defaults to "index.ts". */
    entry?: string;
}

export class Express extends Server<ExpressOptions> {
    private _address?: string;
    private startupLines: string[] = [];

    public get address(): string | undefined { return this._address; }
    public override get prefix() { return this.options?.logPrefix ?? "Express"; }

    protected spawn(): ChildProcessWithoutNullStreams {
        const {
            cwd = process.cwd(),
            env,
            pathPrepend = [],
            defaultPort = 3000,
            command,
            args,
        } = this.options;

        const childEnv: NodeJS.ProcessEnv = { ...process.env, ...env };
        if (pathPrepend.length) {
            const currentPath = process.env.PATH ?? "";
            childEnv.PATH = `${pathPrepend.join(delimiter)}${delimiter}${currentPath}`;
        }

        const spawnOpts: SpawnOptionsWithoutStdio = {
            cwd,
            env: childEnv,
            shell: true,
        };

        this._address = `http://localhost:${defaultPort}`;
        return spawn(command, args, spawnOpts);
    }

    protected override onLine(line: string): void {
        super.onLine(line);
        const l = (line ?? "").trim();
        this.startupLines.push(l);

        if (this.state !== "starting") return;

        const readiness = this.options?.readinessRegex ?? /Test site running at (https?:\/\/localhost:\d+)/i;
        const addressRegex = this.options?.addressRegex ?? /(https?:\/\/localhost:\d+)/i;

        if (readiness.test(l)) {
            const m = addressRegex.exec(l);
            if (m && m[1]) this._address = m[1];
            this.started();
            return;
        }

        const m2 = addressRegex.exec(l);
        if (m2 && m2[1]) {
            this._address = m2[1];
            this.started();
        }
    }

    protected override startingErrorOnClose(code: number): Error {
        if (this.startupLines.length) {
            return new Error(
                `Express server failed to start. Code ${code}.\n\n${this.startupLines.join("\n")}`
            );
        } else {
            return new Error(`Express server failed to start. Code ${code}.`);
        }
    }

    // Helpers to build options
    public static nodeTs(entry = "index.ts", opts: Partial<ExpressOptions> = {}): ExpressOptions {
        return {
            command: "node",
            args: ["--experimental-strip-types", "--no-warnings", entry],
            defaultPort: 3000,
            ...opts,
        };
    }

    public static npmStart(opts: Partial<ExpressOptions> = {}): ExpressOptions {
        return {
            command: "npm",
            args: ["start", "--silent"],
            defaultPort: 3000,
            ...opts,
        };
    }

    public static custom(command: string, args: string[], opts: Partial<ExpressOptions> = {}): ExpressOptions {
        return {
            command,
            args,
            defaultPort: 3000,
            ...opts,
        };
    }
}
