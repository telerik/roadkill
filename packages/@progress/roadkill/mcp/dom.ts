import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { sessions } from "./webdriver.js";

/**
 * Input and button type literals for form elements
 */
type InputType = 
    | "text" | "password" | "email" | "number" | "tel" | "url" | "search" 
    | "date" | "time" | "datetime-local" | "month" | "week" | "color" 
    | "range" | "file" | "hidden" | "checkbox" | "radio" | "submit" 
    | "button" | "reset" | "image" | string;

/**
 * Element node in the DOM tree
 */
interface ElementToken {
    /** HTML tag name (e.g., "div", "span", "input") */
    element: string;
    /** Element ID attribute */
    id?: string;
    /** CSS class names */
    classes?: string[];
    /** ARIA role attribute */
    role?: string;
    /** Input type, button type, etc. */
    type?: InputType;
    /** Link href attribute */
    href?: string;
    /** ARIA attributes (aria-*) */
    aria?: Record<string, string>;
    /** Element bounding box [x, y, width, height] relative to page top-left (outer border, excluding margin) */
    frame?: [number, number, number, number];
    /** True if element is not visible (display:none, visibility:hidden, etc.) */
    hidden?: boolean;
    /** True if element matches a selector query (used in dom-test-selector) */
    match?: boolean;
    /** Child content (text strings and elements) */
    content?: DomToken[];
}

/**
 * Union type for all DOM tokens - either a text string or an element object
 */
type DomToken = string | ElementToken;

/**
 * Root result from DOM snapshot - same structure as ElementToken
 * but represents specifically the root element of a snapshot
 */
type DomSnapshotResult = ElementToken;

/**
 * DOM snapshot function that will be executed in the browser context
 */
function domSnapshotScript(): DomSnapshotResult | { error: string; selector?: string } {
    const opts = arguments[0] || {};
    const selector = opts.rootSelector;

    const root = selector ? document.querySelector(selector) : document.body;
    if (!root) return { error: "root-not-found", selector };

    const ELEMENT_NODE = 1;
    const TEXT_NODE = 3;
    const norm = (s: any) => (s ?? "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");

    function nodeTypeTag(el: any) { return el.tagName ? el.tagName.toLowerCase() : ""; }
    function nodeElementType(el: any, tag: string) {
        if (tag === "button" && el.type) return String(el.type);
        if (tag === "input"  && el.type) return String(el.type);
        return undefined;
    }
    function nodeHref(el: any, tag: string) { return (tag === "a" && el.href) ? String(el.href) : undefined; }

    function snapElement(el: any): ElementToken {
        const tag = nodeTypeTag(el);
        const id = el.id || undefined;
        const classes = el.classList ? Array.from(el.classList).map(String) : [];
        const role = el.getAttribute && el.getAttribute("role") || undefined;
        const elementType = nodeElementType(el, tag);
        const href = nodeHref(el, tag);

        // Get element frame (bounding box) and visibility
        let frame: [number, number, number, number] | undefined = undefined;
        let hidden: boolean | undefined = undefined;
        try {
            // Check if element is intentionally hidden (not just layout/structural)
            const computedStyle = window.getComputedStyle && window.getComputedStyle(el);
            
            // Elements that are structurally invisible but not "hidden" content
            const structuralElements = new Set(['br', 'hr', 'wbr', 'area', 'base', 'col', 'colgroup', 'embed', 'link', 'meta', 'source', 'track', 'param']);
            const isStructural = structuralElements.has(tag);
            
            // Check if any parent is intentionally hidden by CSS
            const isParentHidden = (function() {
                let parent = el.parentElement;
                while (parent && parent !== document.body) {
                    const parentStyle = window.getComputedStyle && window.getComputedStyle(parent);
                    if (parentStyle && (
                        parentStyle.display === "none" ||
                        parentStyle.visibility === "hidden" ||
                        parseFloat(parentStyle.opacity || "1") === 0
                    )) {
                        return true;
                    }
                    // Removed check for parent.hidden - only consider CSS properties
                    parent = parent.parentElement;
                }
                return false;
            })();
            
            // Check for intentional hiding via CSS properties only
            const hasDisplayNone = computedStyle && computedStyle.display === "none";
            const hasVisibilityHidden = computedStyle && computedStyle.visibility === "hidden";
            const hasZeroOpacity = computedStyle && parseFloat(computedStyle.opacity || "1") === 0;
            
            // Check if element is CSS-visible (has proper display and visibility)
            const isCssVisible = computedStyle && 
                computedStyle.display !== "none" && 
                computedStyle.visibility !== "hidden" && 
                parseFloat(computedStyle.opacity || "1") > 0;
            
            // Determine if element is intentionally hidden - only consider CSS properties, not HTML hidden attribute
            const isIntentionallyHidden = 
                hasDisplayNone ||
                hasVisibilityHidden ||
                hasZeroOpacity ||
                isParentHidden ||
                (el.offsetParent === null && !isStructural && computedStyle && computedStyle.position !== "fixed");

            if (isIntentionallyHidden) {
                hidden = true;
            } else {
                const rect = el.getBoundingClientRect();
                // Always try to get coordinates for elements that aren't CSS-hidden
                if (rect) {
                    // Convert to page coordinates (add scroll offset)
                    const x = Math.round(rect.left + window.scrollX);
                    const y = Math.round(rect.top + window.scrollY);
                    const width = Math.round(rect.width);
                    const height = Math.round(rect.height);
                    frame = [x, y, width, height];
                }
                // Never mark as hidden unless explicitly CSS-hidden
            }
        } catch (e) {
            // getBoundingClientRect might fail on some elements
        }

        const aria: any = {};
        if (el.hasAttributes && el.hasAttributes()) {
            for (const a of Array.from(el.attributes)) {
                if ((a as any).name && (a as any).name.startsWith("aria-")) {
                    aria[(a as any).name] = (a as any).value;
                }
            }
        }

        // Process child nodes (including text nodes and elements)
        const content: DomToken[] = [];
        const childNodes = el.childNodes ? Array.from(el.childNodes) : [];
        
        for (const child of childNodes) {
            const node = child as any;
            if (node.nodeType === TEXT_NODE) {
                const text = norm(node.textContent || "");
                if (text) {
                    content.push(text);
                }
            } else if (node.nodeType === ELEMENT_NODE) {
                const childElement = snapElement(node);
                if (childElement) {
                    // Filter out structural elements with no meaningful properties
                    const childTag = childElement.element;
                    const structuralElements = new Set(['br', 'hr', 'wbr', 'area', 'base', 'col', 'colgroup', 'embed', 'link', 'meta', 'source', 'track', 'param']);
                    const isStructural = structuralElements.has(childTag);
                    
                    if (isStructural) {
                        // Only include structural elements if they have meaningful properties
                        const hasProperties = childElement.id || 
                                            (childElement.classes && childElement.classes.length > 0) || 
                                            childElement.role || 
                                            childElement.type || 
                                            childElement.href || 
                                            (childElement.aria && Object.keys(childElement.aria).length > 0) ||
                                            (childElement.content && childElement.content.length > 0);
                        
                        if (hasProperties) {
                            content.push(childElement);
                        }
                        // Otherwise skip this structural element entirely
                    } else {
                        content.push(childElement);
                    }
                }
            }
        }

        return {
            element: tag,
            id,
            classes: classes.length ? classes : undefined,
            role,
            type: elementType,
            href,
            aria: Object.keys(aria).length ? aria : undefined,
            frame,
            hidden,
            content: content.length ? content : undefined
        };
    }

    return snapElement(root) as DomSnapshotResult;
}

/**
 * Return both a readable summary and a machine-parseable JSON payload.
 */
function mcpResult<T>(payload: T, summary?: string): CallToolResult {
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
        "dom-snapshot",
        "Return a complete DOM tree (tag, id, classes, role, aria-*, type, href, text, frame, hidden). " +
        "Frame coordinates are [x, y, width, height] relative to page top-left (outer border, excluding margin). " +
        "Hidden elements have hidden=true and no frame coordinates. " +
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
            format: z
                .enum(["html", "json"])
                .describe("Output format (default: html)")
                .default("html"),
            includeScreenshot: z
                .boolean()
                .describe("Include base64 PNG screenshot of the page")
                .default(false)
        },
        async ({ sessionId, rootSelector, format = "html", includeScreenshot = false }): Promise<CallToolResult> => {
            const session = sessions.get(sessionId);
            if (!session) throw new Error(`Session not found: ${sessionId}`);

            const tree = await session.executeScript(domSnapshotScript, undefined, { rootSelector });

            // Capture screenshot if requested
            let screenshot: string | undefined = undefined;
            if (includeScreenshot) {
                try {
                    screenshot = await session.takeScreenshot();
                } catch (e) {
                    // Screenshot failed, continue without it
                }
            }

            // Convert tree to HTML format if requested (legacy support)
            function treeToHtml(node: any, indent = 0): string {
                if (!node) return "";
                
                // Handle text nodes (now just strings)
                if (typeof node === 'string') {
                    return node;
                }
                
                const spaces = "  ".repeat(indent);
                const tag = node.element || "unknown";
                
                // Build attributes string
                const attrs = [];
                if (node.id) attrs.push(`id="${node.id}"`);
                if (node.classes && node.classes.length > 0) attrs.push(`class="${node.classes.join(" ")}"`);
                if (node.role) attrs.push(`role="${node.role}"`);
                if (node.type) attrs.push(`type="${node.type}"`);
                if (node.href) attrs.push(`href="${node.href}"`);
                if (node.frame) {
                    attrs.push(`frame="${node.frame.join(" ")}"`);
                }
                // Only show hidden if element is actually CSS-hidden (not just HTML hidden attribute)
                if (node.hidden && node.frame === undefined) {
                    attrs.push(`hidden`);
                }
                
                // Add aria attributes
                if (node.aria) {
                    for (const [key, value] of Object.entries(node.aria)) {
                        attrs.push(`${key}="${value}"`);
                    }
                }
                
                const attrStr = attrs.length > 0 ? " " + attrs.join(" ") : "";
                
                // Handle self-closing tags
                const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
                
                if (voidTags.has(tag)) {
                    return `${spaces}<${tag}${attrStr}>`;
                }
                
                const hasContent = node.content && node.content.length > 0;
                
                // Handle empty tags as self-closing
                if (!hasContent) {
                    return `${spaces}<${tag}${attrStr}/>`;
                }
                
                // Build opening tag
                let result = `${spaces}<${tag}${attrStr}>`;
                
                // Add content
                if (hasContent) {
                    const contentHtml = [];
                    let hasTextContent = false;
                    let hasElementContent = false;
                    
                    // First pass: determine content types
                    for (const item of node.content) {
                        if (typeof item === 'string') {
                            hasTextContent = true;
                        } else {
                            hasElementContent = true;
                        }
                    }
                    
                    // Second pass: process content with proper indentation
                    for (let i = 0; i < node.content.length; i++) {
                        const item = node.content[i];
                        if (typeof item === 'string') {
                            // For mixed content with elements, always indent text content
                            const needsIndent = hasElementContent;
                            const textContent = needsIndent ? "  ".repeat(indent + 1) + item : item;
                            contentHtml.push(textContent);
                        } else {
                            const itemHtml = treeToHtml(item, indent + 1);
                            if (itemHtml) {
                                contentHtml.push(itemHtml);
                            }
                        }
                    }
                    
                    if (hasTextContent && !hasElementContent) {
                        // Only text content - inline
                        result += contentHtml.join("");
                    } else if (hasElementContent || hasTextContent) {
                        // Has element content or mixed content - use newlines
                        result += "\n" + contentHtml.join("\n") + "\n" + spaces;
                    }
                }
                
                // Add closing tag
                result += `</${tag}>`;
                
                return result;
            }

            // Return appropriate format
            if (format === "html") {
                const htmlOutput = tree && !(tree as { error?: string }).error ? treeToHtml(tree).trim() : "";
                if (tree && !(tree as { error?: string }).error) {
                    // Return HTML text directly
                    const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [
                        { type: "text", text: "DOM snapshot captured (HTML format)." },
                        { type: "text", text: htmlOutput }
                    ];
                    
                    if (screenshot) {
                        content.push({ type: "image", data: screenshot, mimeType: "image/png" });
                    }
                    
                    return { content } as CallToolResult;
                } else {
                    // Return error message
                    const errorMsg = (tree as { error?: string })?.error === "root-not-found" ? "DOM root not found." : "DOM snapshot returned no data.";
                    return {
                        content: [{ type: "text", text: errorMsg }]
                    } as CallToolResult;
                }
            } else {
                // JSON format (original behavior)
                const payload = { sessionId, rootSelector: rootSelector ?? null, format, tree };
                const result = mcpResult(
                    payload,
                    tree && !(tree as { error?: string }).error ? "DOM snapshot captured (JSON format)." :
                    (tree as { error?: string })?.error === "root-not-found" ? "DOM root not found." :
                    "DOM snapshot returned no data."
                );
                
                // Add screenshot as image if included
                if (screenshot && tree && !(tree as { error?: string }).error) {
                    result.content.push({ type: "image", data: screenshot, mimeType: "image/png" });
                }
                
                return result;
            }
        }
    );

    server.tool(
        "dom-test-selector",
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
        async ({ sessionId, selector, limit = 10 }): Promise<CallToolResult> => {
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
                            text: (el.innerText || el.textContent || "").replace(/\\s+/g, " ").replace(/^\\s+|\\s+$/g, "").slice(0, 100),
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
        "dom-page-info",
        "Get basic page information: title, URL, viewport size, and readyState. " +
        "LLM: Use to understand the current page context.",
        {
            sessionId: z
                .string()
                .min(1)
                .describe("Existing WebDriver session id")
        },
        async ({ sessionId }): Promise<CallToolResult> => {
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
}