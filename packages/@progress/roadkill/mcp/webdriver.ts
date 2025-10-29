import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WebDriverClient, Session, Element, ElementLookup } from "../webdriver.js";
import { runDriver, getDriverAddress } from "./chromedriver.js";

/**
 * Return both a readable summary and a machine-parseable JSON payload.
 * Using two text parts keeps compatibility with all MCP clients.
 */
function mcpResult<T>(payload: T, summary?: string) {
    const parts: Array<{ type: "text"; text: string }> = [];
    if (summary) parts.push({ type: "text", text: summary });
    parts.push({ type: "text", text: JSON.stringify(payload) });
    return { content: parts };
}

/**
 * In-memory session store for WebDriver sessions
 */
export const sessions = new Map<string, Session>();

/**
 * Register vanilla WebDriver API tools with the MCP server
 */
export function registerWebDriverTools(server: McpServer, getDriverAddress?: () => string | null) {

    server.tool(
        "webdriver-start-session",
        "Start a WebDriver session and return a sessionId. " +
        "LLM: Always call this first to obtain a session id before navigation or DOM exploration.",
        {
            browserName: z
                .string()
                .describe("Target browser name (e.g., 'chrome'). Defaults to 'chrome'.")
                .default("chrome")
        },
        async ({ browserName }) => {
            const address = getDriverAddress();
            if (!address) {
                throw new Error("ChromeDriver is not available. Use chromedriver.start first.");
            }

            const wd = new WebDriverClient({
                enableLogging: true,
                log: console.error,
                address,
                logPrefix: "[WebDriver]"
            });

            const session = await wd.newSession({
                capabilities: { browserName }
            });

            sessions.set(session.sessionId, session);

            const payload = {
                sessionId: session.sessionId,
                address,
                capabilities: session.capabilities
            };

            return mcpResult(
                payload,
                `Started session ${session.sessionId} on ${address} (${session.capabilities.browserName} ${session.capabilities.browserVersion}).`
            );
        }
    );

    server.tool(
        "webdriver-navigate",
        "Navigate to a URL. If sessionId is provided, uses existing session. " +
        "If sessionId is omitted, this is a utility shortcut that starts ChromeDriver, creates a session, and navigates - " +
        "compressing the common 'start chromedriver' + 'start session' + 'navigate' workflow. " +
        "LLM: Use with sessionId for existing sessions, or without for quick one-step navigation.",
        {
            url: z
                .string()
                .url()
                .describe("Absolute URL to navigate to (e.g., https://example.com)"),
            sessionId: z
                .string()
                .min(1)
                .describe("Existing WebDriver session id (optional - if omitted, will start ChromeDriver and create new session)")
                .optional(),
            browserName: z
                .string()
                .describe("Target browser name when creating new session (e.g., 'chrome'). Ignored if sessionId provided.")
                .default("chrome")
                .optional(),
            port: z
                .number()
                .int()
                .min(1024)
                .max(65535)
                .describe("ChromeDriver port when starting new session. Ignored if sessionId provided.")
                .default(9515)
                .optional()
        },
        async ({ url, sessionId, browserName = "chrome", port = 9515 }) => {
            let session: Session;
            let isNewSession = false;
            let chromeDriverPort: number | undefined;

            if (sessionId) {
                // Use existing session
                session = sessions.get(sessionId);
                if (!session) throw new Error(`Session not found: ${sessionId}`);
            } else {
                // Utility shortcut: start ChromeDriver + create session + navigate
                isNewSession = true;
                chromeDriverPort = port;

                // Start ChromeDriver
                const driver = await runDriver(port);
                const address = String(driver.address);

                // Create WebDriver client and new session
                const wd = new WebDriverClient({
                    enableLogging: true,
                    log: console.error,
                    address,
                    logPrefix: "[WebDriver]"
                });

                session = await wd.newSession({
                    capabilities: { browserName }
                });

                sessions.set(session.sessionId, session);
                sessionId = session.sessionId;
            }

            // Navigate to URL
            await session.navigateTo(url);
            const current = await session.getCurrentUrl().catch(() => undefined);

            const payload = {
                sessionId: sessionId!,
                url,
                currentUrl: current ?? url,
                ...(isNewSession && {
                    newSession: true,
                    chromeDriverPort,
                    capabilities: session.capabilities
                })
            };

            const summary = isNewSession
                ? `Started ChromeDriver (port ${chromeDriverPort}), created session ${sessionId}, and navigated to ${url}`
                : `Navigated ${sessionId} - ${url}`;

            return mcpResult(payload, summary);
        }
    );

    server.tool(
        "webdriver-find-elements",
        "Direct WebDriver lookup using the standard locator strategies. " +
        "Pass { using, value } exactly per the spec: 'css selector' | 'link text' | 'partial link text' | 'tag name' | 'xpath'. " +
        "Returns elementIds for any matches.",
        {
            sessionId: z
                .string()
                .min(1)
                .describe("Existing WebDriver session id"),
            using: z
                .enum(["css selector", "link text", "partial link text", "tag name", "xpath"])
                .describe("Locator strategy (WebDriver exact string)"),
            value: z
                .string()
                .min(1)
                .describe("Locator value (selector/xpath/text/tag)")
        },
        async ({ sessionId, using, value }) => {
            const session = sessions.get(sessionId);
            if (!session) {
                throw new Error(`Session not found: ${sessionId}`);
            }

            const found = await session.findElements({ using, value } as ElementLookup);
            const elements = found.map(el => ({ elementId: el.elementId }));

            const payload = {
                sessionId,
                using,
                value,
                count: elements.length,
                elements
            };

            const summary =
                elements.length === 0
                    ? "Found 0 elements"
                    : `Found ${elements.length} element${elements.length === 1 ? "" : "s"}`;

            return mcpResult(payload, summary);
        }
    );

    server.tool(
        "webdriver-click-element",
        "Click an element by WebDriver element id within a session. " +
        "LLM: Typically obtain elementId from webdriver.findElements when unique==true.",
        {
            sessionId: z
                .string()
                .min(1)
                .describe("Existing WebDriver session id"),
            elementId: z
                .string()
                .min(1)
                .describe("WebDriver element id (e.g., from webdriver.findElements)")
        },
        async ({ sessionId, elementId }) => {
            const session = sessions.get(sessionId);
            if (!session) throw new Error(`Session not found: ${sessionId}`);
            const el = new Element(session, elementId);
            await el.click();
            return mcpResult({ sessionId, elementId, clicked: true }, `Clicked element ${elementId}`);
        }
    );

    server.tool(
        "webdriver-send-keys",
        "Send keystrokes to an element by WebDriver element id within a session.",
        {
            sessionId: z
                .string()
                .min(1)
                .describe("Existing WebDriver session id"),
            elementId: z
                .string()
                .min(1)
                .describe("WebDriver element id (e.g., from webdriver.findElements)"),
            text: z
                .string()
                .describe("Text to send to the element")
        },
        async ({ sessionId, elementId, text }) => {
            const session = sessions.get(sessionId);
            if (!session) throw new Error(`Session not found: ${sessionId}`);
            const el = new Element(session, elementId);
            await el.sendKeys(text);
            return mcpResult({ sessionId, elementId, text, sent: true }, `Sent "${text}" to element ${elementId}`);
        }
    );

    server.tool(
        "webdriver-take-screenshot",
        "Take a screenshot of the current page in a session.",
        {
            sessionId: z
                .string()
                .min(1)
                .describe("Existing WebDriver session id")
        },
        async ({ sessionId }) => {
            const session = sessions.get(sessionId);
            if (!session) throw new Error(`Session not found: ${sessionId}`);
            const png = await session.takeScreenshot();
            return mcpResult(
                { sessionId, screenshot: png.substring(0, 100) + "...", length: png.length },
                `Screenshot taken (${png.length} chars base64)`
            );
        }
    );

    server.tool(
        "webdriver-execute-script",
        "Execute JavaScript synchronously in the browser context following WebDriver spec. " +
        "The script should use 'arguments[0]', 'arguments[1]', etc. to access parameters and 'return' to return values. " +
        "Do NOT use function() { ... } syntax - provide only the function body. " +
        "Example: 'return document.title;' or 'var element = document.querySelector(arguments[0]); return element.textContent;'",
        {
            sessionId: z
                .string()
                .min(1)
                .describe("Existing WebDriver session id"),
            script: z
                .string()
                .min(1)
                .describe("JavaScript function body (not wrapped in function() {...}). Use 'arguments[N]' to access parameters and 'return' for results."),
            args: z
                .array(z.unknown())
                .describe("Arguments to pass to the script (optional). Accessible as arguments[0], arguments[1], etc.")
                .optional()
                .default([])
        },
        async ({ sessionId, script, args = [] }) => {
            const session = sessions.get(sessionId);
            if (!session) throw new Error(`Session not found: ${sessionId}`);

            const result = await session.executeScript(script, undefined, ...args);

            return mcpResult(
                { 
                    sessionId, 
                    script: script.substring(0, 200) + (script.length > 200 ? "..." : ""), 
                    args,
                    result 
                },
                `Executed script (${script.length} chars) with ${args.length} arguments`
            );
        }
    );

    server.tool(
        "webdriver-execute-script-async",
        "Execute JavaScript asynchronously in the browser context following WebDriver spec. " +
        "The script should use 'arguments[0]', 'arguments[1]', etc. to access parameters. " +
        "The last argument is always a callback function - call it with your result: 'arguments[arguments.length-1](result);' " +
        "Do NOT use function() { ... } syntax - provide only the function body. " +
        "Example: 'setTimeout(function() { arguments[arguments.length-1](document.title); }, 1000);'",
        {
            sessionId: z
                .string()
                .min(1)
                .describe("Existing WebDriver session id"),
            script: z
                .string()
                .min(1)
                .describe("JavaScript function body for async execution. Use 'arguments[N]' for parameters and call 'arguments[arguments.length-1](result)' when done."),
            args: z
                .array(z.unknown())
                .describe("Arguments to pass to the script (optional). Last argument will always be the callback function.")
                .optional()
                .default([])
        },
        async ({ sessionId, script, args = [] }) => {
            const session = sessions.get(sessionId);
            if (!session) throw new Error(`Session not found: ${sessionId}`);

            const result = await session.executeScriptAsync(script, undefined, ...args);

            return mcpResult(
                { 
                    sessionId, 
                    script: script.substring(0, 200) + (script.length > 200 ? "..." : ""), 
                    args,
                    result 
                },
                `Executed async script (${script.length} chars) with ${args.length} arguments`
            );
        }
    );

    server.tool(
        "webdriver-close-session",
        "Dispose (delete) a WebDriver session. " +
        "LLM: Always close sessions you created when done to keep the environment clean.",
        {
            sessionId: z
                .string()
                .min(1)
                .describe("Existing WebDriver session id to close")
        },
        async ({ sessionId }) => {
            const session = sessions.get(sessionId);
            if (!session) throw new Error(`Session not found: ${sessionId}`);
            await session[Symbol.asyncDispose]();
            sessions.delete(sessionId);
            return mcpResult({ sessionId, closed: true }, `Closed session ${sessionId}`);
        }
    );
}

/**
 * Cleanup all WebDriver sessions
 */
export async function cleanupWebDriverSessions() {
    for (const [id, session] of sessions) {
        try { 
            await session[Symbol.asyncDispose](); 
        } catch {}
        sessions.delete(id);
    }
}