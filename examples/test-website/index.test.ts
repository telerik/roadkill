import { ChromeDriver } from "@progress/roadkill/chromedriver.js";
import { Express } from "@progress/roadkill/express.js";
import { Session, WebDriverClient, by } from "@progress/roadkill/webdriver.js";
import { describe, test, expect, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { step } from "@progress/roadkill/utils.js";
import { mkdir, writeFile } from "fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const enableLogging = false;

describe.sequential("test-website", () => {
    let chromedriver: ChromeDriver;
    let express: Express;
    let webdriver: WebDriverClient;
    let session: Session;

    beforeAll(async () => {
        express = new Express(
            Express.npmStart({ cwd: dirname(fileURLToPath(import.meta.url)), enableLogging, port: 3000 }),
        );
        await express.start();

        chromedriver = new ChromeDriver({ args: ["--port=5032"], enableLogging });
        await chromedriver.start();

        // When constructed in beforeAll, manual disposal is required
        webdriver = new WebDriverClient({ address: chromedriver.address!, enableLogging });
        session = await webdriver.newSession({
            capabilities: { timeouts: { implicit: 2000 } },
        });
    }, 60000);

    // Before each: set implicit: 2000
    beforeEach(async () => {
        await session.setTimeouts({ implicit: 2000 });
    });

    afterEach(async () => {
        // Test failure handling can be added here if needed
        // Vitest provides test context differently than Jest
    });

    afterAll(async () => {
        // Manual disposal required when constructed in beforeAll
        await session?.[Symbol.asyncDispose]();
        await chromedriver?.[Symbol.asyncDispose]();
        await express?.[Symbol.asyncDispose]();
    }, 20000);

    test("login flow", async () => {
        await step("navigate to local test site", () =>
            session.navigateTo(express.address!)
        );

        await step("accept GDPR overlay", async () => {
            const iframe = await session.findElement(by.css(".overlay-frame"));
            await iframe.switchToFrame();

            const accept = await session.findElement(by.css("button:nth-of-type(1)"));
            await accept.click();

            // Back to main/top-level browsing context
            await session.switchToFrame(null);
        });

        await step("perform login", async () => {
            const user = await session.findElement(by.css("#username"));
            await user.clear();
            await user.sendKeys("admin");

            const pass = await session.findElement(by.css("#password"));
            await pass.clear();
            await pass.sendKeys("1234");

            const btn = await session.findElement(by.css("button[type=submit]"));
            await btn.click();
        });

        // Assert navigation and page-unique content
        await step("wait for Topics page", async () => {
            await session.setTimeouts({ implicit: 10000 });

            const grid = await session.findElement(by.css("#topics-grid"));
            expect(await grid.getTagName()).toBe("div");

            const url = await session.getCurrentUrl();
            expect(url).toContain("/toc");

            await session.setTimeouts({ implicit: 2000 });
        });

        await step("verify cards exist on Topics page", async () => {
            const links = await session.findElements(by.css("#topics-grid .card a[href]"));
            expect(links.length).toBeGreaterThanOrEqual(3);
        });

        await step("capture and save screenshot", async () => {
            const screenshot = await session.takeScreenshot();
            const dir = `dist/test/login-flow`;
            await mkdir(dir, { recursive: true });
            await writeFile(join(dir, "screenshot.png"), screenshot, { encoding: "base64" });
        });

    }, 30000);
});
