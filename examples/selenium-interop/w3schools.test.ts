import { describe, test, beforeAll, afterAll } from "vitest";
import { Builder, Browser, WebDriver } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import { Session, WebDriverClient, type MatchingCapabilities, } from "@progress/roadkill/webdriver.js";

describe("w3schools", () => {

    let driver: WebDriver;
    let session: Session;

    beforeAll(async () => {

        const port = 5052;
        
        driver = new Builder()
            .setChromeService(new chrome.ServiceBuilder().setPort(port))
            .forBrowser(Browser.CHROME)
            .build();

        // When session is constructed in beforeAll, manual disposal is required
        session = new Session(
            new WebDriverClient({ address: `http://localhost:${port}` }),
                (await driver.getSession()).getId(),
                (await driver.getSession()).getCapabilities() as unknown as MatchingCapabilities);

    }, 30000);

    afterAll(async () => {
        // Manual disposal required when constructed in beforeAll
        await session?.[Symbol.asyncDispose]();
        await driver?.quit();
    });

    test.skip("navigate to js statements page", async context => {
        await driver.navigate().to('http://www.w3schools.com');
        await session.timeout(3000, context.signal);
        await session.navigateTo('http://www.w3schools.com/js')
    }, 20000);
});