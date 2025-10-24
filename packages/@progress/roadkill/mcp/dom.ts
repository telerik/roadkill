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
 * Result from selector testing operations
 */
interface SelectorTestResult {
    selector: string;
    selectorType: 'css' | 'xpath';
    matchCount: number;
    matches: Array<{
        elementId: string;
        tag: string;
        id?: string;
        classes: string[];
        text: string;
        xpath: string;
        attributes: Record<string, string>;
    }>;
    hierarchy: ElementToken | null;
}

/**
 * Error result from DOM operations
 */
interface DomErrorResult {
    error: string;
    selector?: string;
}

/**
 * Union type for all possible DOM processing results
 */
type DomProcessingResult = DomSnapshotResult | SelectorTestResult | DomErrorResult;

/**
 * Generic DOM processing script that handles both snapshot and selector testing
 * Always returns JSON - formatting to HTML happens on the Node.js side
 */
function domProcessingScript(): DomProcessingResult {
    // Parse arguments
    const opts = arguments[0] || {};
    const selectorText = arguments[1]; // CSS or XPath selector for testing
    const selectorType = arguments[2]; // 'css', 'xpath', or undefined for auto-detect
    
    // Define all utility functions inline since they need to be available in browser context
    const ELEMENT_NODE = 1;
    const TEXT_NODE = 3;
    const norm = (s: any) => (s ?? "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
    
    // Define filtered elements once at the top level
    const filteredElements = new Set(["script", "style", "def", "defs"]);

    function nodeTypeTag(el: any) { return el.tagName ? el.tagName.toLowerCase() : ""; }
    function nodeElementType(el: any, tag: string) {
        if (tag === "button" && el.type) return String(el.type);
        if (tag === "input"  && el.type) return String(el.type);
        return undefined;
    }
    function nodeHref(el: any, tag: string) { return (tag === "a" && el.href) ? String(el.href) : undefined; }

    function snapElement(el: any, matchedElements?: Set<any>): any {
        const tag = nodeTypeTag(el);
        
        // Skip filtered elements entirely
        if (filteredElements.has(tag)) {
            return null;
        }
        
        const id = el.id || undefined;
        const classes = el.classList ? Array.from(el.classList).map(String) : [];
        const role = el.getAttribute && el.getAttribute("role") || undefined;
        const elementType = nodeElementType(el, tag);
        const href = nodeHref(el, tag);
        const isMatch = matchedElements ? matchedElements.has(el) : undefined;

        // Get element frame (bounding box) and visibility
        let frame: [number, number, number, number] | undefined = undefined;
        let hidden: boolean | undefined = undefined;
        try {
            const computedStyle = window.getComputedStyle && window.getComputedStyle(el);
            
            const structuralElements = new Set(['br', 'hr', 'wbr', 'area', 'base', 'col', 'colgroup', 'embed', 'link', 'meta', 'source', 'track', 'param']);
            const isStructural = structuralElements.has(tag);
            
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
                    parent = parent.parentElement;
                }
                return false;
            })();
            
            const hasDisplayNone = computedStyle && computedStyle.display === "none";
            const hasVisibilityHidden = computedStyle && computedStyle.visibility === "hidden";
            const hasZeroOpacity = computedStyle && parseFloat(computedStyle.opacity || "1") === 0;
            
            // Check for invisible transforms (scale of 0 in any dimension)
            let hasInvisibleTransform = false;
            if (computedStyle && computedStyle.transform && computedStyle.transform !== 'none') {
                const transform = computedStyle.transform;
                // Matrix format: matrix(a, b, c, d, e, f) where a=scaleX, d=scaleY
                const matrixMatch = transform.match(/matrix\(([^)]+)\)/);
                if (matrixMatch) {
                    const values = matrixMatch[1].split(',').map(v => parseFloat(v.trim()));
                    if (values.length >= 6) {
                        const scaleX = values[0];
                        const scaleY = values[3];
                        hasInvisibleTransform = scaleX === 0 || scaleY === 0;
                    }
                }
                
                // Check for scale3d
                const scale3dMatch = transform.match(/scale3d\(([^)]+)\)/);
                if (scale3dMatch) {
                    const values = scale3dMatch[1].split(',').map(v => parseFloat(v.trim()));
                    if (values.length >= 3) {
                        const scaleX = values[0];
                        const scaleY = values[1];
                        hasInvisibleTransform = scaleX === 0 || scaleY === 0;
                    }
                }
                
                // Check for individual scale transforms
                if (transform.includes('scaleX(0)') || transform.includes('scaleY(0)') || transform.includes('scale(0')) {
                    hasInvisibleTransform = true;
                }
            }
            
            const isIntentionallyHidden = 
                hasDisplayNone ||
                hasVisibilityHidden ||
                hasZeroOpacity ||
                hasInvisibleTransform ||
                isParentHidden ||
                (el.offsetParent === null && !isStructural && computedStyle && computedStyle.position !== "fixed");

            // Set hidden flag independently of frame calculation
            if (isIntentionallyHidden) {
                hidden = true;
            }

            // Always try to get frame coordinates, regardless of hidden status
            // Some hidden elements (like visibility:hidden) still have layout dimensions
            const rect = el.getBoundingClientRect();
            if (rect && (rect.width > 0 || rect.height > 0)) {
                const x = Math.round(rect.left + window.scrollX);
                const y = Math.round(rect.top + window.scrollY);
                const width = Math.round(rect.width);
                const height = Math.round(rect.height);
                frame = [x, y, width, height];
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

        const content: any[] = [];
        const childNodes = el.childNodes ? Array.from(el.childNodes) : [];
        
        for (const child of childNodes) {
            const node = child as any;
            if (node.nodeType === TEXT_NODE) {
                const text = norm(node.textContent || "");
                if (text) {
                    content.push(text);
                }
            } else if (node.nodeType === ELEMENT_NODE) {
                const childTag = nodeTypeTag(node);
                
                // Skip filtered elements entirely
                if (filteredElements.has(childTag)) {
                    continue;
                }
                
                const childElement = snapElement(node, matchedElements);
                if (childElement) {
                    const structuralElements = new Set(['br', 'hr', 'wbr', 'area', 'base', 'col', 'colgroup', 'embed', 'link', 'meta', 'source', 'track', 'param']);
                    const isStructural = structuralElements.has(childTag);
                    
                    if (isStructural) {
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
                    } else {
                        content.push(childElement);
                    }
                }
            }
        }

        return {
            element: tag,
            ...(id ? { id } : {}),
            ...(classes.length ? { classes } : {}),
            ...(role ? { role } : {}),
            ...(elementType ? { type: elementType } : {}),
            ...(href ? { href } : {}),
            ...(Object.keys(aria).length ? { aria } : {}),
            ...(frame ? { frame } : {}),
            ...(hidden ? { hidden } : {}),
            ...(isMatch ? { match: isMatch } : {}),
            ...(content.length ? { content } : {})
        };
    }

    try {
        // If no selector is provided, behave like dom-snapshot
        if (!selectorText) {
            const rootSelector = opts.rootSelector;
            const root = rootSelector ? document.querySelector(rootSelector) : document.body;
            if (!root) return { error: "root-not-found", selector: rootSelector };
            return snapElement(root);
        }

        // Selector testing mode
        const selector = selectorText;
        
        // Auto-detect selector type if not specified
        let isXPath = false;
        if (selectorType === 'xpath') {
            isXPath = true;
        } else if (selectorType === 'css') {
            isXPath = false;
        } else {
            // Auto-detect
            isXPath = selector.includes('/') || selector.includes('::') || 
                     selector.startsWith('//') || selector.startsWith('./') ||
                     selector.includes('[contains(') || selector.includes('[@');
        }
        
        let matchedElements: Element[] = [];
        
        if (isXPath) {
            const xpathResult = document.evaluate(
                selector, 
                document, 
                null, 
                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, 
                null
            );
            
            for (let i = 0; i < xpathResult.snapshotLength; i++) {
                const node = xpathResult.snapshotItem(i);
                if (node && node.nodeType === Node.ELEMENT_NODE) {
                    matchedElements.push(node as Element);
                }
            }
        } else {
            matchedElements = Array.from(document.querySelectorAll(selector));
        }
        
        if (matchedElements.length === 0) {
            return {
                selector,
                selectorType: isXPath ? 'xpath' : 'css',
                matchCount: 0,
                matches: [],
                hierarchy: null
            };
        }
        
        const matchedSet = new Set(matchedElements);
        
        // Find all relevant elements: matches + their parents + their children
        const relevantElements = new Set<Element>();
        
        // Add matched elements
        matchedElements.forEach(el => relevantElements.add(el));
        
        // Add all parents of matched elements
        matchedElements.forEach(el => {
            let parent = el.parentElement;
            while (parent && parent !== document.documentElement) {
                relevantElements.add(parent);
                parent = parent.parentElement;
            }
        });
        
        // Add all children of matched elements
        matchedElements.forEach(el => {
            const children = el.querySelectorAll('*');
            children.forEach(child => relevantElements.add(child));
        });
        
        // Helper function to generate XPath for an element
        function getElementXPath(element: Element): string {
            if (element.id) {
                return `//*[@id="${element.id}"]`;
            }
            
            const parts: string[] = [];
            let currentElement: Element | null = element;
            
            while (currentElement && currentElement !== document.documentElement) {
                let tagName = currentElement.tagName.toLowerCase();
                let index = 1;
                
                let sibling = currentElement.previousElementSibling;
                while (sibling) {
                    if (sibling.tagName.toLowerCase() === tagName) {
                        index++;
                    }
                    sibling = sibling.previousElementSibling;
                }
                
                const nextSibling = currentElement.nextElementSibling;
                let hasMultipleSiblings = index > 1;
                if (!hasMultipleSiblings && nextSibling) {
                    let next = nextSibling;
                    while (next) {
                        if (next.tagName.toLowerCase() === tagName) {
                            hasMultipleSiblings = true;
                            break;
                        }
                        next = next.nextElementSibling;
                    }
                }
                
                if (hasMultipleSiblings) {
                    parts.unshift(`${tagName}[${index}]`);
                } else {
                    parts.unshift(tagName);
                }
                
                currentElement = currentElement.parentElement;
            }
            
            return '/' + parts.join('/');
        }
        
        // Build element info for WebDriver interaction
        const matches = matchedElements.map((el, index) => {
            const elementKey = `element-${Date.now()}-${index}`;
            
            return {
                elementId: elementKey,
                tag: el.tagName ? el.tagName.toLowerCase() : "",
                id: el.id || undefined,
                classes: el.classList ? Array.from(el.classList) : [],
                text: ((el as any).innerText || el.textContent || "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "").slice(0, 100),
                xpath: getElementXPath(el),
                attributes: el.hasAttributes ? Array.from(el.attributes).reduce((acc, attr) => {
                    acc[attr.name] = attr.value;
                    return acc;
                }, {} as Record<string, string>) : {}
            };
        });
        
        // Helper function to generate hierarchy tree
        function generateHierarchy(element: Element, relevantElements: Set<Element>, matchedElements: Set<Element>): any {
            if (!relevantElements.has(element)) {
                return null;
            }
            
            const elementToken = snapElement(element, matchedElements);
            
            if (elementToken.content) {
                elementToken.content = elementToken.content.filter((item: any) => {
                    if (typeof item === 'string') {
                        return true;
                    }
                    const childElement = findElementInDOM(item, element);
                    return childElement && relevantElements.has(childElement);
                }).map((item: any) => {
                    if (typeof item === 'string') {
                        return item;
                    }
                    const childElement = findElementInDOM(item, element);
                    return childElement ? generateHierarchy(childElement, relevantElements, matchedElements) : item;
                }).filter(Boolean);
                
                if (elementToken.content.length === 0) {
                    elementToken.content = undefined;
                }
            }
            
            return elementToken;
        }
        
        // Helper to find actual DOM element from ElementToken
        function findElementInDOM(elementToken: any, parentElement: Element): Element | null {
            if (!elementToken || typeof elementToken === 'string') return null;
            
            const children = Array.from(parentElement.children);
            for (const child of children) {
                if (child.tagName.toLowerCase() === elementToken.element) {
                    if (elementToken.id && child.id === elementToken.id) {
                        return child;
                    }
                    if (!elementToken.id && elementToken.classes) {
                        const childClasses = Array.from(child.classList);
                        const hasAllClasses = elementToken.classes.every((cls: string) => childClasses.includes(cls));
                        if (hasAllClasses && childClasses.length === elementToken.classes.length) {
                            return child;
                        }
                    }
                    if (!elementToken.id && (!elementToken.classes || elementToken.classes.length === 0)) {
                        return child;
                    }
                }
            }
            return null;
        }
        
        // Generate hierarchy tree starting from document.body but only including relevant elements
        const hierarchyRoot = generateHierarchy(document.body, relevantElements, matchedSet);
        
        return {
            selector,
            selectorType: isXPath ? 'xpath' : 'css',
            matchCount: matchedElements.length,
            matches,
            hierarchy: hierarchyRoot
        };
        
    } catch (error) {
        return {
            selector: selectorText,
            error: (error as Error).message
        };
    }
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
 * Convert DOM element tree to HTML string representation
 */
function treeToHtml(node: DomToken | null | undefined, indent = 0): string {
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
    // Show hidden attribute if element is hidden, regardless of frame presence
    if (node.hidden) {
        attrs.push(`hidden`);
    }
    if (node.match) attrs.push(`match`); // Mark matched elements
    
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
                const itemHtml = treeToHtml(item as DomToken, indent + 1);
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
                .default("html")
                .optional(),
            includeScreenshot: z
                .boolean()
                .describe("Include base64 PNG screenshot of the page")
                .default(false)
                .optional()
        },
        async ({ sessionId, rootSelector, format = "html", includeScreenshot = false }): Promise<CallToolResult> => {
            const session = sessions.get(sessionId);
            if (!session) throw new Error(`Session not found: ${sessionId}`);

            const tree = await session.executeScript(domProcessingScript, undefined, { rootSelector });

            // Capture screenshot if requested
            let screenshot: string | undefined = undefined;
            if (includeScreenshot) {
                try {
                    screenshot = await session.takeScreenshot();
                } catch (e) {
                    // Screenshot failed, continue without it
                }
            }

            // Return appropriate format
            if (format === "html") {
                const htmlOutput = tree && !(tree as { error?: string }).error ? treeToHtml(tree as ElementToken).trim() : "";
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
        "Test CSS or XPath selectors and return element hierarchy showing matches, parents, and children. " +
        "Supports both CSS selectors (document.querySelectorAll) and XPath selectors (document.evaluate). " +
        "Returns matched elements with WebDriver element IDs, element hierarchy in HTML/JSON format, and summary. " +
        "Shows only matched elements, their parents, and children to help narrow down selectors. " +
        "LLM: Use to validate selectors and understand element context for test authoring.",
        {
            sessionId: z
                .string()
                .min(1)
                .describe("Existing WebDriver session id"),
            selector: z
                .string()
                .min(1)
                .describe("CSS selector or XPath to test (e.g., 'button.submit' or '//button[@class=\"submit\"]')"),
            format: z
                .enum(["html", "json"])
                .describe("Output format for element hierarchy (default: html)")
                .default("html")
                .optional(),
            limit: z
                .number()
                .describe("Max number of matches to return (default 10)")
                .int()
                .min(1)
                .max(100)
                .default(10)
                .optional()
        },
        async ({ sessionId, selector, format = "html", limit = 10 }): Promise<CallToolResult> => {
            const session = sessions.get(sessionId);
            if (!session) throw new Error(`Session not found: ${sessionId}`);

            const result = await session.executeScript(domProcessingScript, undefined, {}, selector, undefined);

            if ((result as any).error) {
                return mcpResult(
                    { sessionId, selector, error: (result as any).error },
                    `Selector error: ${(result as any).error}`
                );
            }

            const { selectorType, matchCount, matches, hierarchy } = result as any;
            
            // Limit matches if needed
            const limitedMatches = matches.slice(0, limit);
            
            // Create summary text
            const summaryText = `${selectorType.toUpperCase()} selector "${selector}" matched ${matchCount} elements`;
            
            // Prepare the response content
            const content: Array<{ type: "text"; text: string }> = [
                { type: "text", text: summaryText }
            ];
            
            // Add match details as JSON
            content.push({
                type: "text", 
                text: JSON.stringify({
                    selector,
                    selectorType,
                    matchCount,
                    matches: limitedMatches
                })
            });
            
            // Add hierarchy in requested format
            if (hierarchy) {
                if (format === "html") {
                    const hierarchyHtml = treeToHtml(hierarchy as ElementToken);
                    if (hierarchyHtml) {
                        content.push({ type: "text", text: hierarchyHtml });
                    }
                } else {
                    content.push({ type: "text", text: JSON.stringify({ hierarchy }) });
                }
            }
            
            return { content };
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