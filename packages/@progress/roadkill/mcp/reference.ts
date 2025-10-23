import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

/**
 * Return both a readable summary and a machine-parseable JSON payload.
 */
function mcpResult<T>(payload: T, summary?: string) {
    const parts: Array<{ type: "text"; text: string }> = [];
    if (summary) parts.push({ type: "text", text: summary });
    parts.push({ type: "text", text: JSON.stringify(payload) });
    return { content: parts };
}

// Resolve sibling file (prefers .ts, falls back to .js)
async function readSiblingModuleBase(nameNoExt: "webdriver" | "chromedriver" | "semantic" | "semantic-jsx"): Promise<{ path: string; content: string }> {
    const base = dirname(dirname(fileURLToPath(import.meta.url))); // Go up one level from mcp/
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

/**
 * Register reference tools for reading framework source and generating example projects
 */
export function registerReferenceTools(server: McpServer) {
    server.tool(
        "reference-api",
        "Read the shipped Roadkill framework source file for reference. " +
        "LLM: Use this to understand available WebDriver/ChromeDriver/Semantic APIs when authoring tests.",
        {
            file: z
                .enum(["webdriver", "chromedriver", "semantic", "semantic-jsx"])
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

    server.tool(
        "reference-example",
        "Return a minimal Vitest project (package.json, tsconfig.json, example.test.ts) using Roadkill's ChromeDriver + WebDriverClient. " +
        "LLM: Use as a template and fill in selectors you discovered via the DOM and semantic tools.",
        {},
        async () => {
            const files = [
                {
                    filename: "package.json",
                    content: `{
  "name": "roadkill-test-example",
  "version": "0.1.0",
  "description": "Example using Vitest and Roadkill",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@progress/roadkill": "^0.3.0",
    "@types/node": "^20.8.2",
    "typescript": "^5.2.2",
    "vitest": "^3.2.0"
  },
  "license": "MIT"
}`
                },
                {
                    filename: "tsconfig.json",
                    content: `{
  "compilerOptions": {
    "module": "Node16",
    "target": "ESNext",
    "moduleResolution": "Node16",
    "esModuleInterop": true,
    "types": ["vitest/globals"]
  }
}`
                },
                {
                    filename: "vitest.config.ts",
                    content: `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    timeout: 30000
  }
});`
                },
                {
                    filename: "example.test.ts",
                    content:
`import { ChromeDriver } from "@progress/roadkill/chromedriver.js";
import { WebDriverClient, Session, by } from "@progress/roadkill/webdriver.js";
import { discover } from "@progress/roadkill/semantic.js";
import { describe, test, beforeAll, afterAll, expect } from "vitest";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

describe("example.com automation", () => {
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

    afterAll(async () => { 
        try { 
            await session?.[Symbol.asyncDispose](); 
        } finally { 
            await chromedriver?.[Symbol.asyncDispose](); 
        } 
    }, 20000);

    test("navigate and discover semantic objects", async () => {
        await session.navigateTo("https://example.com");

        // Discover semantic objects on the page
        const root = await discover(session);
        console.log("Discovered semantic objects:", root);

        // Try a robust selector: link text
        const link = await session.findElement(by.link("More information..."));
        await link.click();

        // Take screenshot
        const png = await session.takeScreenshot();
        const dir = join("test-results");
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, "screenshot.png"), png, { encoding: "base64" });

        const url = await session.getCurrentUrl();
        expect(url).toContain("iana.org");
    }, 20000);
});`
                }
            ];

            return mcpResult(
                { files, note: "Write these files into a new test folder, run \`npm install\`, then \`npm test\`." },
                `Returned Vitest project with ${files.length} files.`
            );
        }
    );
}