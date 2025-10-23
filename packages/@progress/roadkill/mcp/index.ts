#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { registerChromeDriverTools, getDriverAddress, cleanupChromeDriver } from "./chromedriver.js";
import { registerWebDriverTools, cleanupWebDriverSessions } from "./webdriver.js";
import { registerDomTools } from "./dom.js";
import { registerReferenceTools } from "./reference.js";

const server = new McpServer({
    name: "roadkill-mcp",
    version: "0.3.0",
    description:
        "Roadkill MCP: Modular tools for WebDriver automation with semantic object discovery. " +
        "Provides: (1) ChromeDriver service management, (2) WebDriver session control, " +
        "(3) DOM browser and selector tools, (4) Semantic object exploration. " +
        "Typical workflow: Start ChromeDriver - Create WebDriver session - Navigate and explore - " +
        "Use DOM tools for selectors - Discover semantic objects - Interact with page elements. " +
        "Generate portable tests using the framework tools."
});

server.tool("hello", "Greets back the user! Useful for probing the MCP pipeline.", {
    name: z.string().describe("User name to greet")
}, async ({ name }) => {
    const payload = { hello: name };
    const summary = `Hello, ${name}!`;
    const parts: Array<{ type: "text"; text: string }> = [];
    if (summary) parts.push({ type: "text", text: summary });
    parts.push({ type: "text", text: JSON.stringify(payload) });
    return { content: parts };
});

// Reference tools (API docs and examples)
registerReferenceTools(server);

// ChromeDriver service management
registerChromeDriverTools(server);

// WebDriver session control  
registerWebDriverTools(server, getDriverAddress);

// DOM browser and selector tools
registerDomTools(server);

const transport = new StdioServerTransport();

// Cleanup function
const cleanUp = async () => {
    try {
        await cleanupWebDriverSessions();
        await cleanupChromeDriver();
    } catch (error) {
        console.error("Cleanup error:", error);
    }
};

// Transport cleanup
transport.onclose = cleanUp;

// Process signal handlers
process.on("SIGINT", async () => {
    try {
        await cleanUp();
    } finally { 
        process.exit(0); 
    }
});

process.on("SIGTERM", async () => {
    try {
        await cleanUp();
    } finally { 
        process.exit(0); 
    }
});

// Start the server
await server.connect(transport);