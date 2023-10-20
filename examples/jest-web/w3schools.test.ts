import { ChromeDriver } from "@progress/roadkill/chromedriver.js";
import { Session, WebDriverClient, by } from "@progress/roadkill/webdriver.js";
import { describe, test, expect } from "@jest/globals";
import { sleep, getState, step } from "@progress/roadkill/utils.js";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const enableLogging = false;

describe("w3schools", () => {

    let chromedriver: ChromeDriver;
    let webdriver: WebDriverClient;
    let session: Session;

    beforeAll(async () => {
        const { signal } = getState();
        chromedriver = new ChromeDriver({ args: ["--port=5032"], enableLogging });
        await chromedriver.start();
        webdriver = new WebDriverClient({ address: chromedriver.address, enableLogging });
        session = await webdriver.newSession({
            capabilities: {
                timeouts: {
                    implicit: 2000
                }
            }
        }
        // TODO: This will die after 30000ms, because it uses the hook signal
        );
    }, 30000);

    afterEach(async () => {
        const { signal, test, hook } = getState();
        if (test && test.status == "fail") {
            console.log("post-mortem collecting test failure artifacts for: " + test.names.join(" > "));
            // For example try to capture screenshot from session...
        }
    });

    afterAll(async () => await session?.dispose(), 5000);
    afterAll(async () => await chromedriver?.dispose(), 10000);

    test.skip("navigate to js statements page", async () => {
        // roadkill APIs will use global implicit signal if provided by the test framework,
        // but for async node APIs like `writeFile`, you will need to obtain it at the beginning of your test.
        const { signal } = getState();

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
            const dir = `dist/test/${expect.getState().currentTestName}`;
            await step("make dir recursive", () =>
                mkdir(dir, { recursive: true }));
            await step("write file", () =>
                writeFile(join(dir, `screenshot.png`), screenshot, { encoding: "base64", signal }));
        });

    }, 20000);

    test("rogue steps", async () => {
        await step("step 1.", async () => {
            await step("step 1.1.", async () => {
                await sleep(40000);
            });
        });
        await step("step 2.", async () => {
            await sleep(6000);
        });
        await step("step 3.", async () => {
            await sleep(20000);
        })
    }, 10000);

    test("next test", async () => {
        await step("something slow", () =>
            new Promise(resolve => setTimeout(resolve, 50000)));
    }, 60000);
});