#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { ChromeDriver } from "./chromedriver.js";
import { WebDriverClient, Session, Element } from "./webdriver.js";

import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// ───────────────────────────────────────────────────────────
// ChromeDriver singleton + runDriver()
// ───────────────────────────────────────────────────────────

const driver = new ChromeDriver({
    enableLogging: true,
    log: console.error,
    logPrefix: "ChromeDriver",
    args: ["--port=9515", "--enable-chrome-logs"]
});

let driverWait: Promise<ChromeDriver> | null = null;

/**
 * Idempotent bring-up for ChromeDriver:
 *   - running   → resolve immediately with driver
 *   - new       → start() once and wait
 *   - starting  → wait for "running" or error
 *   - aborted/ disposed → throw
 */
async function runDriver(): Promise<ChromeDriver> {
    switch (driver.state) {
        case "running":
            return driver;

        case "new":
            if (!driverWait) {
                driverWait = driver
                    .start()
                    .then(() => driver)
                    .finally(() => { driverWait = null; });
            }
            return driverWait;

        case "starting":
            if (!driverWait) {
                driverWait = new Promise<ChromeDriver>((resolve, reject) => {
                    const onState = (s: string) => {
                        if (s === "running") {
                            cleanup();
                            resolve(driver);
                        } else if (s === "disposed" || s === "abort start" || s === "abort running") {
                            cleanup();
                            reject(new Error(`ChromeDriver failed to start (state: ${s}).`));
                        }
                    };
                    const cleanup = () => driver.off("state", onState as any);
                    driver.on("state", onState as any);
                }).finally(() => { driverWait = null; });
            }
            return driverWait;

        default:
            throw new Error(`ChromeDriver is not available (state: ${driver.state}).`);
    }
}

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────

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

// Resolve sibling file (prefers .ts, falls back to .js)
async function readSiblingModuleBase(nameNoExt: "webdriver" | "chromedriver"): Promise<{ path: string; content: string }> {
    const base = dirname(fileURLToPath(import.meta.url));
    const tsPath = join(base, `${nameNoExt}.ts`);
    const jsPath = join(base, `${nameNoExt}.js`);
    try {
        const content = await readFile(tsPath, "utf-8");
        return { path: tsPath, content };
    } catch {
        try {
            const content = await readFile(jsPath, "utf-8");
            return { path: jsPath, content };
        } catch {
            throw new Error(`Could not find ${nameNoExt}.ts or ${nameNoExt}.js next to this MCP server.`);
        }
    }
}

// ───────────────────────────────────────────────────────────
// In-memory session store
// ───────────────────────────────────────────────────────────
const sessions = new Map<string, Session>();

// ───────────────────────────────────────────────────────────
// MCP server + tools
// ───────────────────────────────────────────────────────────
const server = new McpServer({
    name: "roadkill-mcp",
    version: "0.0.1",
    description:
        "Roadkill MCP: tools that let an LLM mimic WebDriver flows end-to-end. " +
        "Typical usage: (1) webdriver.startSession → (2) webdriver.navigate → " +
        "(3) webdriver.domSnapshot / webdriver.selectElements to explore and craft selectors → " +
        "(4) webdriver.clickElement (and other future interactions) → (5) close session. " +
        "Use the framework.* tools to read the shipped Roadkill WebDriver/ChromeDriver sources and fetch a Jest example. " +
        "From user prompts, explore with the DOM tools, propose stable selectors (ids/roles/text), " +
        "then generate portable tests in Jest using @progress/roadkill/webdriver.js."
});

// ── hello ──────────────────────────────────────────────────
server.tool(
    "hello",
    "Greets back the user! Useful for probing the MCP pipeline.",
    {
        name: z.string().describe("User name to greet")
    },
    async ({ name }) => mcpResult({ hello: name }, `Hello, ${name}! 👋`)
);

// ── webdriver.startSession ─────────────────────────────────
server.tool(
    "webdriver.startSession",
    "Start a WebDriver session and return a sessionId. " +
    "LLM: Always call this first to obtain a session id before navigation or DOM exploration.",
    {
        browserName: z
            .string()
            .describe("Target browser name (e.g., 'chrome'). Defaults to 'chrome'.")
            .default("chrome")
    },
    async ({ browserName }) => {
        const d = await runDriver();
        const address = String(d.address);

        const wd = new WebDriverClient({
            enableLogging: true,
            // If your WebDriverClientOptions lacks `log`, keep the cast:
            log: console.error as any,
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

// ── webdriver.navigate ─────────────────────────────────────
server.tool(
    "webdriver.navigate",
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
            `Navigated ${sessionId} → ${url}`
        );
    }
);

// ── webdriver.status ───────────────────────────────────────
server.tool(
    "webdriver.status",
    "Report ChromeDriver state/address. " +
    "LLM: Use this to diagnose driver availability if a session fails to start.",
    {},
    async () => {
        const state = driver.state;
        const addr = driver.address ? String(driver.address) : null;
        return mcpResult({ state, address: addr }, `ChromeDriver: ${state}${addr ? ` @ ${addr}` : ""}`);
    }
);

// ── webdriver.domSnapshot ──────────────────────────────────
server.tool(
    "webdriver.domSnapshot",
    "Return a trimmed DOM tree (tag, id, classes, role, aria-*, type, href, text). " +
    "LLM: Use to understand page structure and propose stable selectors. Prefer id/role/unique text.",
    {
        sessionId: z
            .string()
            .min(1)
            .describe("Existing WebDriver session id"),
        rootSelector: z
            .string()
            .describe("Optional CSS selector for sub-tree root; defaults to document.body")
            .optional(),
        maxDepth: z
            .number()
            .describe("Max depth to traverse (default 64)")
            .int()
            .min(0)
            .max(255)
            .default(64),
        maxChildren: z
            .number()
            .describe("Max direct children per node (default 64)")
            .int()
            .min(1)
            .max(255)
            .default(64),
        maxTextLen: z
            .number()
            .describe("Max characters of normalized text captured per node (default 120)")
            .int()
            .min(0)
            .max(2000)
            .default(120)
    },
    async ({ sessionId, rootSelector, maxDepth = 64, maxChildren = 64, maxTextLen = 120 }) => {
        const session = sessions.get(sessionId);
        if (!session) throw new Error(`Session not found: ${sessionId}`);

        const tree = await session.executeScript(
            `
            return (function() {
                const opts = arguments[0] || {};
                const selector = opts.rootSelector;
                const maxDepth = Number.isFinite(opts.maxDepth) ? opts.maxDepth : 64;
                const maxChildren = Number.isFinite(opts.maxChildren) ? opts.maxChildren : 64;
                const maxTextLen = Number.isFinite(opts.maxTextLen) ? opts.maxTextLen : 120;

                const root = selector ? document.querySelector(selector) : document.body;
                if (!root) return { error: "root-not-found", selector };

                const ELEMENT_NODE = 1;
                const norm = s => (s ?? "").replace(/\\s+/g, " ").trim();

                function nodeTypeTag(el) { return el.tagName ? el.tagName.toLowerCase() : ""; }
                function nodeTypeAttr(el, tag) {
                    if (tag === "button" && el.type) return String(el.type);
                    if (tag === "input"  && el.type) return String(el.type);
                    return undefined;
                }
                function nodeHref(el, tag) { return (tag === "a" && el.href) ? String(el.href) : undefined; }
                function nodeText(el) {
                    const raw = (el.innerText ?? el.textContent ?? "");
                    const txt = norm(raw);
                    return maxTextLen > 0 ? txt.slice(0, maxTextLen) : txt;
                }

                function snap(el, depth) {
                    if (!el || (el.nodeType || 0) !== ELEMENT_NODE) return null;
                    if (depth > maxDepth) return null;

                    const tag = nodeTypeTag(el);
                    const id = el.id || undefined;
                    const classes = el.classList ? Array.from(el.classList) : [];
                    const role = el.getAttribute && el.getAttribute("role") || undefined;
                    const type = nodeTypeAttr(el, tag);
                    const href = nodeHref(el, tag);
                    const text = nodeText(el);

                    const aria = {};
                    if (el.hasAttributes && el.hasAttributes()) {
                        for (const a of el.attributes) {
                            if (a.name && a.name.startsWith("aria-")) aria[a.name] = a.value;
                        }
                    }

                    const kids = [];
                    const children = el.children ? Array.from(el.children) : [];
                    for (let i = 0; i < children.length && i < maxChildren; i++) {
                        const child = snap(children[i], depth + 1);
                        if (child) kids.push(child);
                    }

                    return {
                        tag, id, classes, role, type, href, text,
                        aria: Object.keys(aria).length ? aria : undefined,
                        children: kids.length ? kids : undefined
                    };
                }

                return snap(root, 0);
            })();
            `,
            undefined,
            { rootSelector, maxDepth, maxChildren, maxTextLen }
        );

        return mcpResult(
            { sessionId, rootSelector: rootSelector ?? null, tree },
            tree && !tree.error ? "DOM snapshot captured." :
            tree?.error === "root-not-found" ? "DOM root not found." :
            "DOM snapshot returned no data."
        );
    }
);

// ── webdriver.findElements (spec-accurate & minimal) ─────────────────────────
server.tool(
    "webdriver.findElements",
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

        // Call WebDriver as-is
        const found = await session.findElements({ using, value } as any);

        // Return only elementIds (minimal); easy to compose with clickElement later.
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

// ── webdriver.clickElement ─────────────────────────────────
server.tool(
    "webdriver.clickElement",
    "Click an element by WebDriver element id within a session. " +
    "LLM: Typically obtain elementId from webdriver.selectElements when unique==true.",
    {
        sessionId: z
            .string()
            .min(1)
            .describe("Existing WebDriver session id"),
        elementId: z
            .string()
            .min(1)
            .describe("WebDriver element id (e.g., from webdriver.selectElements)")
    },
    async ({ sessionId, elementId }) => {
        const session = sessions.get(sessionId);
        if (!session) throw new Error(`Session not found: ${sessionId}`);
        const el = new Element(session, elementId);
        await el.click();
        return mcpResult({ sessionId, elementId, clicked: true }, `Clicked element ${elementId}`);
    }
);

// ── webdriver.closeSession ────────────────────────────────
server.tool(
    "webdriver.closeSession",
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
        await session.dispose();
        sessions.delete(sessionId);
        return mcpResult({ sessionId, closed: true }, `Closed session ${sessionId}`);
    }
);

// ── framework.read ────────────────────────────────────────
server.tool(
    "framework.read",
    "Read the shipped Roadkill framework source file for reference. " +
    "LLM: Use this to understand available WebDriver/ChromeDriver APIs when authoring Jest tests.",
    {
        file: z
            .enum(["webdriver", "chromedriver"])
            .describe("Which framework file to read")
    },
    async ({ file }) => {
        const { path, content } = await readSiblingModuleBase(file);
        return mcpResult(
            { file, path, length: content.length, content },
            `Read ${file} framework source from ${path} (${content.length} chars).`
        );
    }
);

// ── framework.exampleTest ─────────────────────────────────
server.tool(
    "framework.exampleTest",
    "Return a minimal Jest project (package.json, tsconfig.json, example.spec.ts) using Roadkill's ChromeDriver + WebDriverClient. LLM: Use as a template and fill in selectors you discovered via the DOM tools.",
    {},
    async () => {
        const files = [
            {
                filename: "package.json",
                content: `{
  "name": "jest-web",
  "version": "0.1.4",
  "description": "Example using jest and roadkill",
  "type": "module",
  "private": "true",
  "scripts": {
    "test": "node --experimental-vm-modules ../../node_modules/jest/bin/jest.js --detectOpenHandles --forceExit"
  },
  "devDependencies": {
    "@jest/globals": "^29.7.0",
    "@progress/roadkill": "^0.2.4",
    "@types/jest": "^29.5.5",
    "@types/node": "^20.8.2",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "typescript": "^5.2.2"
  },
  "license": "MIT",
  "jest": {
    "preset": "ts-jest/presets/default-esm",
    "testEnvironment": "@progress/roadkill/jest-environment.ts",
    "reporters": [
      "summary"
    ]
  }
}`
            },
            {
                filename: "tsconfig.json",
                content: `{
  "compilerOptions": {
    "module": "Node16",
    "target": "ESNext",
    "moduleResolution": "Node16",
    "esModuleInterop": true
  }
}`
            },
            {
                filename: "example.spec.ts",
                content:
`import { ChromeDriver } from "@progress/roadkill/chromedriver.js";
import { WebDriverClient, Session, by } from "@progress/roadkill/webdriver.js";
import { describe, test, beforeAll, afterAll, expect } from "@jest/globals";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

describe("example.com smoke", () => {
    let chromedriver: ChromeDriver;
    let webdriver: WebDriverClient;
    let session: Session;

    beforeAll(async () => {
        chromedriver = new ChromeDriver({ args: ["--port=9515"] });
        await chromedriver.start();
        webdriver = new WebDriverClient({ address: chromedriver.address });
        session = await webdriver.newSession({
            capabilities: { timeouts: { implicit: 2000 } }
        });
    }, 30000);

    afterAll(async () => { try { await session?.dispose(); } finally { await chromedriver?.dispose(); } }, 20000);

    test("navigate and click 'More information...'", async () => {
        await session.navigateTo("https://example.com");

        // Try a robust selector: link text
        const link = await session.findElement(by.link("More information..."));
        await link.click();

        const png = await session.takeScreenshot();
        const dir = join("dist","test","example");
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir,"screenshot.png"), png, { encoding: "base64" });

        const url = await session.getCurrentUrl();
        expect(url).toContain("iana.org");
    }, 20000);
});`
            }
        ];

        return mcpResult(
            { files, note: "Write these files into a new example folder, run `pnpm i` or `npm i`, then `npm test`." },
            `Returned Jest project with 3 files.`
        );
    }
);

// ───────────────────────────────────────────────────────────
// Transport + cleanup
// ───────────────────────────────────────────────────────────
const transport = new StdioServerTransport();

transport.onclose = async () => {
    try {
        for (const [id, s] of sessions) {
            try { await s.dispose(); } catch {}
            sessions.delete(id);
        }
        await driver?.dispose();
    } catch {}
};

process.on("SIGINT", async () => {
    try {
        for (const [id, s] of sessions) { try { await s.dispose(); } catch {} sessions.delete(id); }
        await driver?.dispose();
    } finally { process.exit(0); }
});

process.on("SIGTERM", async () => {
    try {
        for (const [id, s] of sessions) { try { await s.dispose(); } catch {} sessions.delete(id); }
        await driver?.dispose();
    } finally { process.exit(0); }
});

await server.connect(transport);
