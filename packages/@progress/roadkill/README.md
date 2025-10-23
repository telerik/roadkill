# Roadkill
> WebDriver for the Masses

***Version: Alpha! Not ready for use public adoption yet.***

A [node.js](https://nodejs.org/en) testing solution over the [WebDriver](https://www.w3.org/TR/webdriver2/) protocol. Will also consider [WebDriver BiDi](https://w3c.github.io/webdriver-bidi/).

## Requirements

- **Node.js 22+** (required for ECMAScript 2024 Explicit Resource Management)
- **TypeScript 5.2+** (for native Disposable support)

Powered by:
 - [Vitest](https://vitest.dev) - Fast unit test framework
 - [TypeScript](https://www.typescriptlang.org)
 - [Promise based](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
 - [Errors with causes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause)
 - [AbortSignals](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)
 - [ECMAScript 2024 Explicit Resource Management](https://github.com/tc39/proposal-explicit-resource-management)
 - all the fancy tech...

A [WebDriver](https://www.w3.org/TR/webdriver2/) based slim testing framework. Closes the gaps between QAs and Front-End developers by:

 - Sharing the same TypeScript or JavaScript language with ***Angular***, ***React*** and ***Vue*** front-end developers
 - Stay within the [nodejs](https://nodejs.org/en) ecosystem
 - Skill-transfer between QAs and Front-End devs
 - Share the lightweight VSCode IDE
 - Compile-time type-checking

## Modern Resource Management

The `@progress/roadkill` uses ECMAScript 2024 Explicit Resource Management for automatic cleanup:

### Per-Test Automatic Cleanup (Recommended)

```typescript
import { describe, it } from "vitest";
import { WebDriverClient } from "@progress/roadkill";

describe("my tests", () => {
  it("automatically cleans up resources", async () => {
    // Automatic cleanup with using declarations - preferred pattern
    await using client = new WebDriverClient("http://localhost:4444");
    await using session = await client.session({ browserName: "chrome" });
    
    await session.navigate("https://example.com");
    // Resources automatically disposed when test completes
  });
});
```

### Suite-Level Manual Cleanup (When Needed)

```typescript
import { describe, it, beforeAll, afterAll } from "vitest";
import { WebDriverClient } from "@progress/roadkill";

describe("my test suite", () => {
  let client: WebDriverClient;
  let session: Session;

  beforeAll(async () => {
    // When constructed in beforeAll, manual disposal is required
    client = new WebDriverClient("http://localhost:4444");
    session = await client.session({ browserName: "chrome" });
  });

  afterAll(async () => {
    // ECMAScript 2024 symbol-based disposal
    await session?.[Symbol.asyncDispose]();
    // Note: WebDriverClient doesn't need disposal, only sessions do
  });

  it("reuses session across tests", async () => {
    await session.navigate("https://example.com");
  });
});
```

## Vitest Integration

To set up testing with Vitest, add to your `package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^1.6.1"
  }
}
```

## Context-Aware Signal Handling

The framework provides context-aware WebDriver operations that automatically receive timeout and cancellation signals:

```typescript
import { describe, it } from "vitest";
import { WebDriverClient } from "@progress/roadkill";

describe("signal handling", () => {
  it("per-test automatic cleanup", async () => {
    await using client = new WebDriverClient("http://localhost:4444");
    await using session = await client.session({ browserName: "chrome" });
    
    // All operations automatically receive the test's AbortSignal
    await session.navigate("https://example.com");
    const element = await session.findElement("css selector", "h1");
    await element.click(); // Will be cancelled if test times out
    // Automatic cleanup when test ends
  });

  // Or with beforeAll/afterAll pattern
  let sharedSession: Session;
  
  beforeAll(async () => {
    const client = new WebDriverClient("http://localhost:4444");
    sharedSession = await client.session({ browserName: "chrome" });
  });
  
  afterAll(async () => {
    await sharedSession?.[Symbol.asyncDispose](); // ECMAScript 2024 disposal
  });

  it("shared session across tests", async () => {
    await sharedSession.navigate("https://example.com");
    // Still gets automatic signal handling
  });
});
```

The WebDriver client automatically inherits cancellation signals from the current test context, eliminating the need for manual signal management.

## Example Output

Example test run with automatic resource cleanup:
```
✓ webdriver tests
✓ automatic cleanup tests
✓ context-aware signal tests

Test Files  3 passed (3)
Tests      12 passed (12)
Duration   1.23s
```

All WebDriver sessions and resources are automatically cleaned up using ECMAScript disposable patterns.

## Model Context Protocol (MCP) Integration

Roadkill includes a Model Context Protocol server that provides WebDriver automation tools to AI assistants like Claude Desktop.

### VS Code MCP Configuration

To use Roadkill's MCP server in VS Code with the Claude Desktop extension, add this configuration to your MCP settings:

```json
{
  "mcpServers": {
    "roadkill": {
      "command": "npx",
      "args": ["@progress/roadkill"]
    }
  }
}
```

This provides access to ChromeDriver management, WebDriver session control, DOM exploration, and semantic page object discovery tools directly in your AI chat interface.

**Available MCP Tools:**
- **ChromeDriver**: `chromedriver.start`, `chromedriver.stop`, `chromedriver.status`, `chromedriver.restart`
- **WebDriver**: Session management, navigation, element interaction, screenshots
- **DOM Browser**: Page snapshots, selector testing, script execution
- **Semantic Discovery**: Intelligent page object discovery and interaction