import { ChromeDriver } from "@progress/roadkill/chromedriver.js";
import { Session, WebDriverClient, by } from "@progress/roadkill/webdriver.js";
import { describe, expect } from "@jest/globals";
import { delay, getState } from "@progress/roadkill/utils.js";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const enableLogging = global.roadkillEnableLogging;

describe("w3schools", () => {

    let chromedriver: ChromeDriver;
    let webdriver: WebDriverClient;
    let session: Session;

    beforeAll(async () => {
        const { signal } = getState();
        chromedriver = new ChromeDriver({ args: ["--port=5024"], enableLogging });
        await chromedriver.start();
        webdriver = new WebDriverClient({ address: chromedriver.address, enableLogging });
        session = await webdriver.newSession({
            capabilities: {
                timeouts: {
                    implicit: 2000
                }
            }
        });
    }, 30000);

    afterAll(async () => await session?.dispose(), 5000);
    afterAll(async () => await chromedriver?.dispose(), 10000);

    test.skip("navigate to js statements page", async () => {
        // roadkill APIs will use global implicit signal if provided by the test framework,
        // but for async node APIs like `writeFile`, you will need to obtain it at the beginning of your test.
        const { signal } = getState();

        await session.navigateTo("https://www.w3schools.com/js");

        try {
            // If GDPR opens, accept all...
            const acceptAllCookies = await session.findElement(by.css(`#accept-choices`));
            await acceptAllCookies.click();
        } catch {}

        const statements = await session.findElement(by.xPath(`//a[text()="JS Statements"]`));
        await statements.click();

        await delay(1000);

        const screenshot = await session.takeScreenshot();
        const dir = `dist/test/${expect.getState().currentTestName}`;
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, `screenshot.png`), screenshot, { encoding: "base64", signal });
    }, 20000);
});