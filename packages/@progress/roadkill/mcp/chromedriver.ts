import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ChromeDriver } from "../chromedriver.js";

/**
 * Return both a readable summary and a machine-parseable JSON payload.
 */
function mcpResult<T>(payload: T, summary?: string) {
    const parts: Array<{ type: "text"; text: string }> = [];
    if (summary) parts.push({ type: "text", text: summary });
    parts.push({ type: "text", text: JSON.stringify(payload) });
    return { content: parts };
}

/**
 * ChromeDriver singleton - will be recreated if port changes
 */
let driver: ChromeDriver | null = null;
let currentPort = 9515; // default port
let driverWait: Promise<ChromeDriver> | null = null;

/**
 * Get or create ChromeDriver instance with specified port
 */
function getDriver(port: number = 9515): ChromeDriver {
    if (!driver || currentPort !== port) {
        // If port changed, dispose old driver first
        if (driver && currentPort !== port) {
            driver[Symbol.asyncDispose]().catch(() => {});
        }
        
        currentPort = port;
        driver = new ChromeDriver({
            enableLogging: true,
            log: console.error,
            logPrefix: "ChromeDriver",
            args: [`--port=${port}`, "--enable-chrome-logs"]
        });
        driverWait = null; // Reset wait promise when creating new driver
    }
    return driver;
}

/**
 * Idempotent bring-up for ChromeDriver:
 *   - running   - resolve immediately with driver
 *   - new       - start() once and wait
 *   - starting  - wait for "running" or error
 *   - aborted/ disposed - throw
 */
export async function runDriver(port: number = 9515): Promise<ChromeDriver> {
    const currentDriver = getDriver(port);
    
    switch (currentDriver.state) {
        case "running":
            return currentDriver;

        case "new":
            if (!driverWait) {
                driverWait = currentDriver
                    .start()
                    .then(() => currentDriver)
                    .finally(() => { driverWait = null; });
            }
            return driverWait;

        case "starting":
            if (!driverWait) {
                driverWait = new Promise<ChromeDriver>((resolve, reject) => {
                    const onState = (s: string) => {
                        if (s === "running") {
                            cleanup();
                            resolve(currentDriver);
                        } else if (s === "disposed" || s === "abort start" || s === "abort running") {
                            cleanup();
                            reject(new Error(`ChromeDriver failed to start (state: ${s}).`));
                        }
                    };
                    const cleanup = () => currentDriver.off("state", onState);
                    currentDriver.on("state", onState);
                }).finally(() => { driverWait = null; });
            }
            return driverWait;

        default:
            throw new Error(`ChromeDriver is not available (state: ${currentDriver.state}).`);
    }
}

/**
 * Get ChromeDriver address if available
 */
export function getDriverAddress(): string | null {
    return driver?.address ? String(driver.address) : null;
}

/**
 * Register ChromeDriver service tools with the MCP server
 */
export function registerChromeDriverTools(server: McpServer) {

    server.tool(
        "chromedriver-status",
        "Report ChromeDriver state/address. " +
        "LLM: Use this to diagnose driver availability if a session fails to start.",
        {},
        async () => {
            const currentDriver = driver || getDriver(); // Get current or default driver
            const state = currentDriver.state;
            const addr = currentDriver.address ? String(currentDriver.address) : null;
            return mcpResult({ state, address: addr, port: currentPort }, `ChromeDriver: ${state}${addr ? ` @ ${addr}` : ""} (port: ${currentPort})`);
        }
    );

    server.tool(
        "chromedriver-start",
        "Start ChromeDriver service if not already running. " +
        "LLM: Use this before creating WebDriver sessions if ChromeDriver is not running. " +
        "Optionally specify a custom port (default: 9515).",
        {
            port: z.number().int().min(1024).max(65535).optional().describe("Port for ChromeDriver to listen on (default: 9515)")
        },
        async ({ port = 9515 }) => {
            const d = await runDriver(port);
            const addr = String(d.address);
            return mcpResult(
                { state: d.state, address: addr, port },
                `ChromeDriver started at ${addr}`
            );
        }
    );

    server.tool(
        "chromedriver-stop",
        "Stop ChromeDriver service. " +
        "LLM: Use this when you're completely done to clean up resources.",
        {},
        async () => {
            if (!driver) {
                return mcpResult(
                    { previousState: "not running", currentState: "not running" },
                    "ChromeDriver was not running"
                );
            }
            
            const prevState = driver.state;
            await driver[Symbol.asyncDispose]();
            return mcpResult(
                { previousState: prevState, currentState: driver.state },
                `ChromeDriver stopped (was: ${prevState})`
            );
        }
    );

    server.tool(
        "chromedriver-restart",
        "Restart ChromeDriver service (stop then start). " +
        "LLM: Use this if ChromeDriver gets into a bad state. " +
        "Optionally specify a custom port (default: keeps current port or 9515).",
        {
            port: z.number().int().min(1024).max(65535).optional().describe("Port for ChromeDriver to listen on (default: current port or 9515)")
        },
        async ({ port }) => {
            const restartPort = port ?? currentPort;
            const prevState = driver?.state ?? "not running";
            
            if (driver) {
                await driver[Symbol.asyncDispose]();
            }
            
            const d = await runDriver(restartPort);
            const addr = String(d.address);
            return mcpResult(
                { previousState: prevState, currentState: d.state, address: addr, port: restartPort },
                `ChromeDriver restarted (was: ${prevState}, now: ${d.state} @ ${addr})`
            );
        }
    );
}

/**
 * Cleanup ChromeDriver
 */
export async function cleanupChromeDriver() {
    try {
        if (driver) {
            await driver[Symbol.asyncDispose]();
        }
    } catch {}
}