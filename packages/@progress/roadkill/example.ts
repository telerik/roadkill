import fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

import { ChromeDriver } from "./chromedriver.js";
import { ElementLookup, Session, WebDriverClient, by } from "./webdriver.js";
import { start, delay, timeout, URL } from "./utils.js";

const chromedriver = new ChromeDriver({
    // Path to the directory containing the ChromeDriver executable - the root of the repo.
    path: resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
});
const url: URL = await chromedriver.start();

const client = new WebDriverClient(url, fetch);

// // This links to safari, you will need to manually call "/usr/bin/safaridriver --diagnose --port 1550"
// const client = new WebDriverClient("http://localhost:1550", fetch);

console.log(`Testing on address: ${client}`);

console.log(`Status: ${JSON.stringify(await client.status(), null, "  ")}`);

const session = await client.newSession({ capabilities: {} });

process.on("uncaughtException", async (e) => {
    try {
        console.log(e);
        console.log(`Node uncaughtException...`);
        console.log(`session.dispose()...`);
        await session.dispose();
        console.log(`chromedriver.dispose()...`);
        await chromedriver.dispose();
    } catch(e) {
    } finally {}
});

// throw new Error("Fail fast!");

console.log(`Timeouts: ${JSON.stringify(await session.getTimeouts(), null, "  ")}`);
console.log(`Set implicit timeout to 5000`);
await session.setTimeouts({ implicit: 5000 });
console.log(`Timeouts: ${JSON.stringify(await session.getTimeouts(), null, "  ")}`);

// Wait for 5 seconds before termination...
console.log("Wait for 5 seconds");
await delay(1000);

await session.navigateTo("https://abv.bg/");
await delay(3000);

const window = await session.getWindow();
console.log(`Window: ${window.handle}`);

console.log(`WindowRect: ${JSON.stringify(await session.getWindowRect())}`);

const windows = await session.getWindows();
console.log(`Windows (${windows.length}): ${JSON.stringify(windows.map(w => w.handle), null, "  ")}`);

const loginField = await session.findElement(by.css("input.abv-LoginField"));
console.log(`Login field: ${loginField.elementId}`);

// await loginField.findElement(by.css("missing child"));

console.log(`Is login field selected: ${JSON.stringify(await loginField.isSelected())}`);

console.log(`Is login field attribute 'maxlength': ${JSON.stringify(await loginField.getAttribute("maxlength"))}`);
console.log(`Is login field attribute 'unicorn': ${JSON.stringify(await loginField.getAttribute("unicorn"))}`);

console.log(`Is login field property 'id': ${JSON.stringify(await loginField.getProperty("id"))}`);

console.log(`Serialization of an element: ${JSON.stringify(loginField, null, "  ")}`);

console.log(`Capture screenshot...`);
const loginBase64Screenshot = await loginField.takeScreenshot();
console.log(loginBase64Screenshot);

await fs.mkdir("dist", { recursive: true });
await fs.writeFile("dist/screenshot.png", loginBase64Screenshot, { encoding: "base64" });

console.log(`Print to PDF...`);
const loginBase64PDF = await session.printPage();
await fs.writeFile("dist/abv.pdf", loginBase64PDF, { encoding: "base64" });

const someDivs = await session.findElements(by.css("div"));
console.log(`Some div elements, count: ${someDivs.length}`);

const activeElement = await session.getActiveElement();
console.log(`Active element: ${activeElement.elementId}`);

console.log(`Current URL: ${await session.getCurrentUrl()}`);

await delay(1000);
console.log("Type user name 'pana'");
await delay(1000);
await loginField.sendKeys("pana");

// Run some scripts...
const incrementSync = await session.executeScript(`
    return arguments[0] + 1;
`, null, 5);
console.log(`Execute in browser sync increment of 5: ${incrementSync}`);

const incrementAsync = await session.executeScriptAsync(`
    // Arguments passed to "executeScriptAsync"
    var i = arguments[0];
    // Then a "result" callback, that is always passed as last argument by specification.
    var result = arguments[1];
    setTimeout(() => result(i + 1), 1000);
`, null, 5);
console.log(`Execute in browser async increment of 5: ${incrementAsync}`);

const incrementSyncWithAwait = await session.executeScript(`
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    };
    // executeScript doesn't pass "result" function as last argument, but supports async/await:
    await delay(1000);
    return arguments[0] + 1;
`, null, 5);
console.log(`Execute in browser sync with await increment of 5: ${incrementSyncWithAwait}`);

const getElementByCSSSelectorUsingScript = await session.executeScript(`
    return document.querySelector("input.abv-LoginField");
`);
console.log(`Input got by script: ${JSON.stringify(getElementByCSSSelectorUsingScript, null, "  ")}`);

console.log(`Get cookies: ${JSON.stringify(await session.getCookies(), null, "  ")}`);

export class TestFail extends Error {
}

console.log("Tests with deadlines.");
const any = (... args: AbortSignal[]) => (AbortSignal as any).any(args); // No typing for AbortSignal.any

// Mock of a testing library...
async function test(name: string, fn: (deadline: AbortSignal) => void | Promise<void>) {
    try {
        await fn(AbortSignal.timeout(1500))
    } catch(cause) {
        throw new TestFail(name, { cause });
    }
}

try {
    await test("Close the EULA and click DOX", async deadline => {
        await delay(500, deadline);
        await session.findElement(by.css("input.abv-LoginField"), deadline);
        await delay(500, deadline);
        await session.findElement(by.css("fail here because there are no such classes"), deadline);
        await delay(500, deadline);
        await session.findElement(by.css("input.abv-LoginField"), deadline);
        await delay(500, deadline);
        await session.findElement(by.css("input.abv-LoginField"), deadline);
        // Will eventually throw with good stack trace...
    });
} catch(error) {
    console.log(error);
}

console.log("Convenience methods...");

// How we will implement convenience APIs
export class ConvenienceAPIError extends Error {
    constructor(error?: string, options?: ErrorOptions, args?: {}) {
        super(error, options);
        if (args)
            for(const key in args)
                this[key] = args[key];
    }
}

export async function findAndClick(session: Session, lookup: ElementLookup, signal?: undefined | number | AbortSignal) {
    signal = start(signal);
    try {
        do {
            try {
                const element = await session.findElement(lookup, signal);
                await element.click(signal);
            } catch(error) {
                if (!signal || signal.aborted) throw error;
            }
            // If abort signal was passed - retry after a small delay.
            // TODO: Increment the delay after each unsuccessful retry...
            signal && await delay(25, signal);
            // If there is no signal - we don't know how long to keep trying...
        } while(signal);
    } catch(cause) {
        throw new ConvenienceAPIError(`Failed to find and click element by ${lookup.using} "${lookup.value}".`, { cause }, { lookup });
    }
}

try {
    // AbortSignals could also be used to capture good stacktraces
    const deadline = timeout(1500);

    await findAndClick(session, by.link("Приемане и затваряне"), any(deadline, timeout(1000)));
    await findAndClick(session, by.link("DOX"), any(deadline, timeout(1000)));

} catch(error) {
    console.log(error);
}

await delay(3000);
const newWindow = await session.newWindow();
console.log(`New window (${newWindow.type}): ${newWindow.handle}`);

await delay(5000);

console.log("Delete the session");
await session.dispose();

console.log("Kill the chromedriver");
await chromedriver.dispose();

console.log("Exit...");
