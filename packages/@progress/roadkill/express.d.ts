import { type ChildProcessWithoutNullStreams } from "child_process";
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
    /** Port to run the server on. Defaults to 3000. */
    port?: number;
    /** Regex to detect readiness in stdout. */
    readinessRegex?: RegExp;
    /** Regex to extract the address from stdout. */
    addressRegex?: RegExp;
    /** Entry file for node-ts helper. Defaults to "index.ts". */
    entry?: string;
}
export declare class Express extends Server<ExpressOptions> {
    private _address?;
    private startupLines;
    get address(): string | undefined;
    get prefix(): string;
    protected spawn(): ChildProcessWithoutNullStreams;
    protected onLine(line: string): void;
    protected startingErrorOnClose(code: number): Error;
    static nodeTs(entry?: string, opts?: Partial<ExpressOptions>): ExpressOptions;
    static npmStart(opts?: Partial<ExpressOptions>): ExpressOptions;
    static custom(command: string, args: string[], opts?: Partial<ExpressOptions>): ExpressOptions;
}
