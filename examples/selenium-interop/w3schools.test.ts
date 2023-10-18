import { describe, test } from "@jest/globals";
import { Builder, Browser, WebDriver } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import { sleep } from "@progress/roadkill/utils.js";
import { Session, WebDriverClient } from "@progress/roadkill/webdriver.js";

describe("w3schools", () => {

    let driver: WebDriver;
    let session: Session;

    beforeAll(async () => {

        const port = 5052;
        
        driver = new Builder()
            .setChromeService(new chrome.ServiceBuilder().setPort(port))
            .forBrowser(Browser.CHROME)
            .build();

        session = new Session(
            new WebDriverClient({ address: `http://localhost:${port}` }),
                (await driver.getSession()).getId(),
                (await driver.getSession()).getCapabilities() as any);

    }, 30000);

    afterAll(async () => {
        await driver?.quit();
    });

    test.skip("navigate to js statements page", async () => {
        await driver.navigate().to('http://www.w3schools.com');
        await sleep(3000);
        await session.navigateTo('http://www.w3schools.com/js')
    }, 20000);
});