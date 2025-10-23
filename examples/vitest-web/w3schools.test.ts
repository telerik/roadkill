import { ChromeDriver } from "@progress/roadkill/chromedriver.js";
import { Session, WebDriverClient, by } from "@progress/roadkill/webdriver.js";
import { describe, test, expect, beforeAll, afterEach, afterAll } from "vitest";
import { sleep, step } from "@progress/roadkill/utils.js";
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
                timeouts: {
                    implicit: 2000
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

    test("navigate to js statements page", async (context) => {
        const session = suiteSession.context({ signal: context.signal });

        await step("navigate to https://www.w3schools.com/js", () =>
            session.navigateTo("https://www.w3schools.com/js"));

        await step("dismiss GDPR if any", async () => {
            try {
                // If GDPR opens, accept all...
                const acceptAllCookies = await session.findElement(by.css(`#accept-choices`));
                await acceptAllCookies.click();
            } catch {}
        });

        await step(`find and click "JS Statements"`, async () => { 
            const statements = await session.findElement(by.xPath(`//a[text()="JS Statements"]`));
            await statements.click();
        });

        await step("sleep 1 sec", () =>
            sleep(1000));

        const screenshot = await step("capture screenshot", () =>
            session.takeScreenshot());

        await step("save screenshot", async () => {
            const dir = `dist/test/navigate-to-js-statements-page`;
            await step("make dir recursive", () =>
                mkdir(dir, { recursive: true }));
            await step("write file", () =>
                writeFile(join(dir, `screenshot.png`), screenshot, { encoding: "base64" }));
        });

    }, 20000);
});