import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sessions } from "./webdriver.js";
import { discover } from "../semantic.js";
import { Element } from "../webdriver.js";

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
 * Register semantic objects exploration tools with the MCP server
 */
export function registerSemanticTools(server: McpServer) {

    // ── semantic.discover ──────────────────────────────────────
    server.tool(
        "semantic.discover",
        "Discover semantic objects on the current page using the Roadkill semantic object system. " +
        "LLM: Use this to find high-level page components like LoginPage, TocPage, forms, etc. " +
        "This is more powerful than raw DOM as it finds meaningful page objects.",
        {
            sessionId: z
                .string()
                .min(1)
                .describe("Existing WebDriver session id")
        },
        async ({ sessionId }) => {
            const session = sessions.get(sessionId);
            if (!session) throw new Error(`Session not found: ${sessionId}`);

            const root = await discover(session);
            
            // Convert the semantic tree to a serializable format
            const convertSemanticObject = (obj: any): any => {
                const result: any = {};
                
                // Copy basic properties
                for (const [key, value] of Object.entries(obj)) {
                    if (key === 'element') {
                        // Convert WebDriver element to just elementId
                        result.elementId = (value as any)?.elementId;
                    } else if (key === 'children' && Array.isArray(value)) {
                        // Recursively convert children
                        result.children = value.map(convertSemanticObject);
                    } else if (typeof value === 'object' && value !== null && 'elementId' in value) {
                        // Convert other WebDriver elements
                        result[key] = { elementId: (value as any).elementId };
                    } else if (typeof value !== 'function') {
                        // Copy non-function properties
                        result[key] = value;
                    }
                }
                
                return result;
            };

            const serializedRoot = convertSemanticObject(root);
            
            // Count semantic objects found
            const countObjects = (obj: any): number => {
                let count = obj['$semantic-class'] ? 1 : 0;
                if (obj.children && Array.isArray(obj.children)) {
                    count += obj.children.reduce((sum: number, child: any) => sum + countObjects(child), 0);
                }
                return count;
            };

            const objectCount = countObjects(serializedRoot);

            return mcpResult(
                { sessionId, semanticObjects: serializedRoot, objectCount },
                `Discovered ${objectCount} semantic object${objectCount === 1 ? '' : 's'}`
            );
        }
    );

    // ── semantic.interact ──────────────────────────────────────
    server.tool(
        "semantic.interact",
        "Interact with a semantic object by its elementId. " +
        "LLM: Use elementIds from semantic.discover to click on semantic objects.",
        {
            sessionId: z
                .string()
                .min(1)
                .describe("Existing WebDriver session id"),
            elementId: z
                .string()
                .min(1)
                .describe("WebDriver element id from semantic.discover"),
            action: z
                .enum(["click", "hover", "focus"])
                .describe("Action to perform on the semantic object")
                .default("click")
        },
        async ({ sessionId, elementId, action = "click" }) => {
            const session = sessions.get(sessionId);
            if (!session) throw new Error(`Session not found: ${sessionId}`);

            // Create element from elementId
            const element = new Element(session, elementId);

            switch (action) {
                case "click":
                    await element.click();
                    break;
                case "hover":
                    // Note: hover might not be available in all WebDriver implementations
                    await session.executeScript("arguments[0].dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));", undefined, element);
                    break;
                case "focus":
                    await session.executeScript("arguments[0].focus();", undefined, element);
                    break;
                default:
                    throw new Error(`Unsupported action: ${action}`);
            }

            return mcpResult(
                { sessionId, elementId, action, performed: true },
                `Performed ${action} on semantic object ${elementId}`
            );
        }
    );

    // ── semantic.getObjectText ──────────────────────────────────────
    server.tool(
        "semantic.getObjectText",
        "Get text content from a semantic object by its elementId. " +
        "LLM: Use to read content from semantic objects discovered with semantic.discover.",
        {
            sessionId: z
                .string()
                .min(1)
                .describe("Existing WebDriver session id"),
            elementId: z
                .string()
                .min(1)
                .describe("WebDriver element id from semantic.discover")
        },
        async ({ sessionId, elementId }) => {
            const session = sessions.get(sessionId);
            if (!session) throw new Error(`Session not found: ${sessionId}`);

            const element = new Element(session, elementId);
            const text = await element.getText();

            return mcpResult(
                { sessionId, elementId, text },
                `Text content: "${String(text).substring(0, 100)}${String(text).length > 100 ? '...' : ''}"`
            );
        }
    );

    // ── semantic.findByText ──────────────────────────────────────
    server.tool(
        "semantic.findByText",
        "Find semantic objects containing specific text. " +
        "LLM: Use to locate semantic objects by their text content.",
        {
            sessionId: z
                .string()
                .min(1)
                .describe("Existing WebDriver session id"),
            searchText: z
                .string()
                .min(1)
                .describe("Text to search for in semantic objects"),
            exactMatch: z
                .boolean()
                .describe("Whether to match exact text or partial (default false)")
                .default(false)
        },
        async ({ sessionId, searchText, exactMatch = false }) => {
            const session = sessions.get(sessionId);
            if (!session) throw new Error(`Session not found: ${sessionId}`);

            const root = await discover(session);
            
            // Search for objects containing the text
            const findObjectsWithText = (obj: any, results: any[] = []): any[] => {
                // Check if this object has matching text
                const hasMatchingText = (obj: any): boolean => {
                    for (const [key, value] of Object.entries(obj)) {
                        if (typeof value === 'string') {
                            if (exactMatch) {
                                if (value === searchText) return true;
                            } else {
                                if (value.toLowerCase().includes(searchText.toLowerCase())) return true;
                            }
                        }
                    }
                    return false;
                };

                if (hasMatchingText(obj)) {
                    const result: any = {
                        semanticClass: obj['$semantic-class'],
                        elementId: obj.element?.elementId
                    };
                    
                    // Add relevant text properties
                    for (const [key, value] of Object.entries(obj)) {
                        if (typeof value === 'string' && key !== '$semantic-class') {
                            result[key] = value;
                        }
                    }
                    
                    results.push(result);
                }
                
                // Recursively search children
                if (obj.children && Array.isArray(obj.children)) {
                    for (const child of obj.children) {
                        findObjectsWithText(child, results);
                    }
                }
                
                return results;
            };

            const matches = findObjectsWithText(root);

            return mcpResult(
                { sessionId, searchText, exactMatch, matchCount: matches.length, matches },
                `Found ${matches.length} semantic object${matches.length === 1 ? '' : 's'} containing "${searchText}"`
            );
        }
    );

    // ── semantic.getObjectProperties ──────────────────────────────────────
    server.tool(
        "semantic.getObjectProperties",
        "Get all properties of a semantic object by its semantic class name. " +
        "LLM: Use to understand what properties are available on discovered semantic objects.",
        {
            sessionId: z
                .string()
                .min(1)
                .describe("Existing WebDriver session id"),
            semanticClass: z
                .string()
                .min(1)
                .describe("Semantic class name (e.g., 'LoginPage', 'TocPage')")
        },
        async ({ sessionId, semanticClass }) => {
            const session = sessions.get(sessionId);
            if (!session) throw new Error(`Session not found: ${sessionId}`);

            const root = await discover(session);
            
            // Find object by semantic class
            const findObjectByClass = (obj: any, className: string): any => {
                if (obj['$semantic-class'] === className) {
                    return obj;
                }
                
                if (obj.children && Array.isArray(obj.children)) {
                    for (const child of obj.children) {
                        const found = findObjectByClass(child, className);
                        if (found) return found;
                    }
                }
                
                return null;
            };

            const semanticObject = findObjectByClass(root, semanticClass);
            
            if (!semanticObject) {
                return mcpResult(
                    { sessionId, semanticClass, found: false },
                    `Semantic object "${semanticClass}" not found`
                );
            }

            // Extract properties (excluding element and children)
            const properties: any = {};
            for (const [key, value] of Object.entries(semanticObject)) {
                if (key !== 'element' && key !== 'children') {
                    if (typeof value === 'object' && value !== null && 'elementId' in value) {
                        properties[key] = { elementId: (value as any).elementId };
                    } else if (typeof value !== 'function') {
                        properties[key] = value;
                    }
                }
            }

            return mcpResult(
                { sessionId, semanticClass, found: true, properties, elementId: semanticObject.element?.elementId },
                `Found "${semanticClass}" with ${Object.keys(properties).length} properties`
            );
        }
    );
}