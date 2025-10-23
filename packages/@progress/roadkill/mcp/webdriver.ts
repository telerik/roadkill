import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WebDriverClient, Session, Element, ElementLookup } from "../webdriver.js";

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
export function registerWebDriverTools(server: McpServer, getDriverAddress: () => string | null) {

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
        "Navigate an existing session to a URL. " +
        "LLM: Use this immediately after starting a session and whenever you need a new page. Reuse the same sessionId.",
        {
            sessionId: z
                .string()
                .min(1)
                .describe("Existing WebDriver session id"),
            url: z
                .string()
                .url()
                .describe("Absolute URL to navigate to (e.g., https://example.com)")
        },
        async ({ sessionId, url }) => {
            const session = sessions.get(sessionId);
            if (!session) throw new Error(`Session not found: ${sessionId}`);
            await session.navigateTo(url);
            const current = await session.getCurrentUrl().catch(() => undefined);
            return mcpResult(
                { sessionId, url, currentUrl: current ?? url },
                `Navigated ${sessionId} - ${url}`
            );
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