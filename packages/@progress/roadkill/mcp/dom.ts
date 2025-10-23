import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sessions } from "./webdriver.js";

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
 * Register DOM browser and selector REPL tools with the MCP server
 */
export function registerDomTools(server: McpServer) {

    server.tool(
        "dom.snapshot",
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
                tree && !(tree as { error?: string }).error ? "DOM snapshot captured." :
                (tree as { error?: string })?.error === "root-not-found" ? "DOM root not found." :
                "DOM snapshot returned no data."
            );
        }
    );

    server.tool(
        "dom.execute",
        "Execute custom JavaScript in the browser context. " +
        "LLM: Use for advanced DOM manipulation, custom selectors, or exploring page state.",
        {
            sessionId: z
                .string()
                .min(1)
                .describe("Existing WebDriver session id"),
            script: z
                .string()
                .min(1)
                .describe("JavaScript code to execute in browser context"),
            args: z
                .array(z.unknown())
                .describe("Arguments to pass to the script (optional)")
                .optional()
                .default([])
        },
        async ({ sessionId, script, args = [] }) => {
            const session = sessions.get(sessionId);
            if (!session) throw new Error(`Session not found: ${sessionId}`);

            const result = await session.executeScript(script, undefined, ...args);

            return mcpResult(
                { sessionId, script: script.substring(0, 200) + (script.length > 200 ? "..." : ""), result },
                `Executed custom script (${script.length} chars)`
            );
        }
    );

    server.tool(
        "dom.testSelector",
        "Test a CSS selector and return matching element info without creating WebDriver elements. " +
        "LLM: Use to validate selectors before using them in webdriver.findElements.",
        {
            sessionId: z
                .string()
                .min(1)
                .describe("Existing WebDriver session id"),
            selector: z
                .string()
                .min(1)
                .describe("CSS selector to test"),
            limit: z
                .number()
                .describe("Max number of matches to return (default 10)")
                .int()
                .min(1)
                .max(100)
                .default(10)
        },
        async ({ sessionId, selector, limit = 10 }) => {
            const session = sessions.get(sessionId);
            if (!session) throw new Error(`Session not found: ${sessionId}`);

            const result = await session.executeScript(
                `
                return (function() {
                    const selector = arguments[0];
                    const limit = arguments[1] || 10;
                    
                    try {
                        const elements = Array.from(document.querySelectorAll(selector));
                        const matches = elements.slice(0, limit).map((el, index) => ({
                            index,
                            tag: el.tagName ? el.tagName.toLowerCase() : "",
                            id: el.id || undefined,
                            classes: el.classList ? Array.from(el.classList) : [],
                            text: (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 100),
                            attributes: el.hasAttributes ? Array.from(el.attributes).reduce((acc, attr) => {
                                acc[attr.name] = attr.value;
                                return acc;
                            }, {}) : {}
                        }));
                        
                        return {
                            selector,
                            totalCount: elements.length,
                            returnedCount: matches.length,
                            matches
                        };
                    } catch (error) {
                        return {
                            selector,
                            error: error.message
                        };
                    }
                })();
                `,
                undefined,
                selector,
                limit
            );

            const summary = (result as any).error 
                ? `Selector error: ${(result as any).error}`
                : `Found ${(result as any).totalCount} matches (showing ${(result as any).returnedCount})`;

            return mcpResult(
                { sessionId, result },
                summary
            );
        }
    );

    server.tool(
        "dom.getPageInfo",
        "Get basic page information: title, URL, viewport size, and readyState. " +
        "LLM: Use to understand the current page context.",
        {
            sessionId: z
                .string()
                .min(1)
                .describe("Existing WebDriver session id")
        },
        async ({ sessionId }) => {
            const session = sessions.get(sessionId);
            if (!session) throw new Error(`Session not found: ${sessionId}`);

            const info = await session.executeScript(
                `
                return {
                    title: document.title,
                    url: window.location.href,
                    readyState: document.readyState,
                    viewport: {
                        width: window.innerWidth,
                        height: window.innerHeight
                    },
                    scroll: {
                        x: window.scrollX,
                        y: window.scrollY
                    },
                    hasFormsCount: document.forms ? document.forms.length : 0,
                    hasLinksCount: document.links ? document.links.length : 0,
                    hasImagesCount: document.images ? document.images.length : 0
                };
                `
            );

            return mcpResult(
                { sessionId, pageInfo: info },
                `Page: "${(info as any).title}" (${(info as any).readyState})`
            );
        }
    );

    server.tool(
        "dom.waitForElement",
        "Wait for an element to appear using a CSS selector. " +
        "LLM: Use when content loads dynamically or after interactions.",
        {
            sessionId: z
                .string()
                .min(1)
                .describe("Existing WebDriver session id"),
            selector: z
                .string()
                .min(1)
                .describe("CSS selector to wait for"),
            timeout: z
                .number()
                .describe("Timeout in milliseconds (default 10000)")
                .int()
                .min(100)
                .max(60000)
                .default(10000),
            pollInterval: z
                .number()
                .describe("Poll interval in milliseconds (default 100)")
                .int()
                .min(50)
                .max(1000)
                .default(100)
        },
        async ({ sessionId, selector, timeout = 10000, pollInterval = 100 }) => {
            const session = sessions.get(sessionId);
            if (!session) throw new Error(`Session not found: ${sessionId}`);

            const result = await session.executeScript(
                `
                return new Promise((resolve) => {
                    const selector = arguments[0];
                    const timeout = arguments[1] || 10000;
                    const pollInterval = arguments[2] || 100;
                    
                    const startTime = Date.now();
                    
                    function check() {
                        const element = document.querySelector(selector);
                        if (element) {
                            resolve({
                                found: true,
                                elapsedTime: Date.now() - startTime,
                                element: {
                                    tag: element.tagName ? element.tagName.toLowerCase() : "",
                                    id: element.id || undefined,
                                    classes: element.classList ? Array.from(element.classList) : [],
                                    text: (element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 100)
                                }
                            });
                        } else if (Date.now() - startTime >= timeout) {
                            resolve({
                                found: false,
                                elapsedTime: Date.now() - startTime,
                                timeout: true
                            });
                        } else {
                            setTimeout(check, pollInterval);
                        }
                    }
                    
                    check();
                });
                `,
                undefined,
                selector,
                timeout,
                pollInterval
            );

            const summary = (result as any).found 
                ? `Element found after ${(result as any).elapsedTime}ms`
                : `Element not found (timeout after ${(result as any).elapsedTime}ms)`;

            return mcpResult(
                { sessionId, selector, waitResult: result },
                summary
            );
        }
    );
}