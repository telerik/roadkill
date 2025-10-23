import { ChromeDriver } from "@progress/roadkill/chromedriver.js";
import { Session, WebDriverClient, by, PageLoadStrategy } from "@progress/roadkill/webdriver.js";
import { describe, test, expect, beforeAll, afterEach, afterAll } from "vitest";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const enableLogging = false;

describe("w3schools", () => {

    let suiteChromedriver: ChromeDriver;
    let suiteWebDriverClient: WebDriverClient;
    let suiteSession: Session;

    beforeAll(async () => {
        suiteChromedriver = new ChromeDriver({ args: ["--port=5034"], enableLogging });
        await suiteChromedriver.start();
        suiteWebDriverClient = new WebDriverClient({ address: suiteChromedriver.address, enableLogging });
        suiteSession = await suiteWebDriverClient.newSession({
            capabilities: {
                pageLoadStrategy: PageLoadStrategy.none,
                timeouts: {
                    implicit: 2000,
                    pageLoad: 5000  // Timeout page loads after 5 seconds
                }
            }
        });
    }, 30000);

    afterEach(async () => {
        // Post-test cleanup with ECMAScript 2024 patterns can be added here
        // Modern failure screenshots could use Vitest's annotation system
    });

    afterAll(async () => {
        await suiteSession?.[Symbol.asyncDispose]();
        // ChromeDriver inherits from Server which has Symbol.asyncDispose
        await suiteChromedriver?.[Symbol.asyncDispose]();
    }, 10000);

    test("navigate to js statements page", async context => {
        const session = suiteSession.context({ signal: context.signal });

        await session.navigateTo("https://www.w3schools.com/js");
        
        // Give the page a moment to start loading since we're using PageLoadStrategy.none
        await session.timeout(2000);

        try {
            // If GDPR opens, accept all...
            const acceptAllCookies = await session.findElement(by.css(`#accept-choices`));
            await acceptAllCookies.click();
        } catch {}

        const statements = await session.findElement(by.xPath(`//a[text()="JS Introduction"]`));
        
        // Use a timeout controller for the click to prevent hanging
        const clickController = new AbortController();
        const clickTimeout = setTimeout(() => clickController.abort(), 8000); // 8 second timeout for click
        
        try {
            await statements.click(clickController.signal);
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Click operation timed out, continuing...');
            } else {
                throw error;
            }
        } finally {
            clearTimeout(clickTimeout);
        }

        await session.timeout(3000);

        const screenshot = await session.takeScreenshot();

        const dir = `dist/test/navigate-to-js-introduction-page`;
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, `screenshot.png`), screenshot, { encoding: "base64" });

    }, 20000);
});