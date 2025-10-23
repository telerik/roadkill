// index.semantic.test.ts
import { describe, test, expect, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { mkdir, writeFile } from "fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Express } from "@progress/roadkill/express.js";
import { ChromeDriver } from "@progress/roadkill/chromedriver.js";
import { Session, WebDriverClient, type Element as WebDriverElement } from "@progress/roadkill/webdriver.js";
import { semantic, discover, SemanticObject, Root, findElementsByCss, FindByCSSFields } from "@progress/roadkill/semantic.js";
import { SemanticJSX, expectSemanticMatch } from "@progress/roadkill/semantic-jsx.js";

const enableLogging = false;

@semantic()
class LoginPage extends SemanticObject {
    titleText?: string | null;
    userInput?: WebDriverElement | null;
    passInput?: WebDriverElement | null;
    submitBtn?: WebDriverElement | null;

    static find() {
        return findElementsByCss<FindByCSSFields<typeof LoginPage>>(
            "main.page-login",
            element => ({
                titleText: (element.querySelector("h1")?.textContent || "").trim(),
                userInput: element.querySelector("#username"),
                passInput: element.querySelector("#password"),
                submitBtn: element.querySelector("button[type=submit]"),
            }));
    }

    async login({ username, password }: { username: string; password: string }) {
        await this.userInput!.clear();
        await this.userInput!.sendKeys(username);
        await this.passInput!.clear();
        await this.passInput!.sendKeys(password);
        await this.submitBtn!.click();
    }
}

@semantic()
class GdprFrame extends SemanticObject {
    static find() {
        return findElementsByCss<FindByCSSFields<typeof GdprFrame>>("iframe.overlay-frame", () => ({}));
    }

    async switchToFrame() {
        await this.element!.switchToFrame();
    }
}

@semantic()
class GdprPanel extends SemanticObject {
    headerText?: string;
    acceptBtn?: WebDriverElement | null;

    static find() {
        return findElementsByCss<FindByCSSFields<typeof GdprPanel>>(
            "main.page-gdpr",
            element => ({
                headerText: (element.querySelector("h2")?.textContent || "").trim(),
                acceptBtn: element.querySelector("#accept"),
            })
        );
    }

    async accept() {
        await this.acceptBtn!.click();
    }
}

@semantic()
class TocPage extends SemanticObject {
    titleText?: string;
    subtitleText?: string;
    cardCount?: number;

    static find() {
        return findElementsByCss<FindByCSSFields<typeof TocPage>>(
            "main.page-topics",
            element => ({
                titleText: (element.querySelector("h1")?.textContent || "").trim(),
                subtitleText: (element.querySelector(".muted")?.textContent || "").trim(),
                cardCount: element.querySelectorAll("#topics-grid .card").length,
            })
        );
    }

    cards(): TopicCard[] { return this.childrenOfType(TopicCard); }
}

@semantic()
class TopicCard extends SemanticObject {
    title?: string;
    description?: string;
    href?: string;

    static find() {
        return findElementsByCss<FindByCSSFields<typeof TopicCard>>(
            "#topics-grid .card",
            element => ({
                title: (element.querySelector("h3")?.textContent || "").trim(),
                description: (element.querySelector("p.muted")?.textContent || "").trim(),
                href: (element.querySelector("a[href]") as HTMLAnchorElement | null)?.href || "",
            })
        );
    }
}

describe.sequential("test-website (semantic objects)", () => {
    let chromedriver: ChromeDriver;
    let express: Express;
    let webdriver: WebDriverClient;
    let session: Session;

    beforeAll(async () => {
        express = new Express(
            Express.npmStart({ cwd: dirname(fileURLToPath(import.meta.url)), enableLogging, port: 3002 }),
        );
        await express.start();

        chromedriver = new ChromeDriver({ args: ["--port=5033"], enableLogging });
        await chromedriver.start();

        webdriver = new WebDriverClient({ address: chromedriver.address!, enableLogging });
        
        session = await webdriver.newSession({
            capabilities: { timeouts: { implicit: 2000 } },
        });
    }, 60000);

    beforeEach(async () => {
        await session.setTimeouts({ implicit: 2000 });
    });

    afterAll(async () => {
        await session?.[Symbol.asyncDispose]();
        await chromedriver?.[Symbol.asyncDispose]();
        await express?.[Symbol.asyncDispose]();
    }, 20000);

    test("login + topics using semantic objects", async () => {

        await session.navigateTo(express.address!);

        const r = await discover(session);

        expectSemanticMatch(r,
            <Root>
                <LoginPage titleText="Roadkill – Test Login">
                    <GdprFrame />
                </LoginPage>
            </Root>);

        expect(r.toXML("    ")).toBe(
            `<Root>
    <LoginPage titleText="Roadkill – Test Login">
        <GdprFrame/>
    </LoginPage>
</Root>`
        );
        let root: Root = r;

        const login = root.childrenOfType(LoginPage)[0];
        const frame = login.childrenOfType(GdprFrame)[0];
        expect(frame).toBeDefined();
        await frame.switchToFrame();

        const gdprRoot = await discover(session);

        expectSemanticMatch(gdprRoot,
            <Root>
                <GdprPanel headerText="GDPR Consent" />
            </Root>);

        expect(gdprRoot.toXML("    ")).toBe(
            `<Root>
    <GdprPanel headerText="GDPR Consent"/>
</Root>`
        );
        const panel = gdprRoot.childrenOfType(GdprPanel)[0];
        await panel.accept();

        await session.switchToFrame(null);
        const loginRoot = await discover(session);
        const loginPage = loginRoot.childrenOfType(LoginPage)[0];
        await loginPage.login({ username: "admin", password: "1234" });

        const deadline = Date.now() + 12_000;
        while (Date.now() < deadline) {
            if ((await session.getCurrentUrl()).includes("/toc")) break;
            await new Promise(r => setTimeout(r, 50));
        }
        if (!(await session.getCurrentUrl()).includes("/toc")) {
            throw new Error("Timed out waiting for /toc");
        }

        const tocRoot = await discover(session);

        expectSemanticMatch(tocRoot,
            <Root>
                <TocPage cardCount={5} subtitleText="Targetable summary cards for QA flows." titleText="Roadkill – Topics">
                    <TopicCard description="Standalone server implementing the WebDriver protocol for Chromium browsers. Roadkill manages lifecycle, logs, and startup detection." href="https://chromedriver.chromium.org/" title="ChromeDriver" />
                    <TopicCard description="The W3C-standard browser automation protocol. Roadkill stays close to spec with typed commands and helpful errors." href="https://www.w3.org/TR/webdriver2/" title="WebDriver" />
                    <TopicCard description="Higher-level DOM discovery helpers that make selectors readable, robust, and LLM-friendly." href="http://localhost:3002/toc#semantic-objects" title="Semantic Objects" />
                    <TopicCard description="Checks Chrome/Node/ChromeDriver versions, manages drivers, and streamlines CI/dev workflows." href="http://localhost:3002/toc#roadkill-cli" title="Roadkill CLI" />
                    <TopicCard description="Expose Roadkill via the Model Context Protocol so LLMs can inspect pages and iteratively author tests." href="https://modelcontextprotocol.io/" title="MCP Integration" />
                </TocPage>
            </Root>);

        const xml = tocRoot.toXML("    ");
        expect(xml).toBe(
            `<Root>
    <TocPage cardCount="5" subtitleText="Targetable summary cards for QA flows." titleText="Roadkill – Topics">
        <TopicCard description="Standalone server implementing the WebDriver protocol for Chromium browsers. Roadkill manages lifecycle, logs, and startup detection." href="https://chromedriver.chromium.org/" title="ChromeDriver"/>
        <TopicCard description="The W3C-standard browser automation protocol. Roadkill stays close to spec with typed commands and helpful errors." href="https://www.w3.org/TR/webdriver2/" title="WebDriver"/>
        <TopicCard description="Higher-level DOM discovery helpers that make selectors readable, robust, and LLM-friendly." href="http://localhost:3002/toc#semantic-objects" title="Semantic Objects"/>
        <TopicCard description="Checks Chrome/Node/ChromeDriver versions, manages drivers, and streamlines CI/dev workflows." href="http://localhost:3002/toc#roadkill-cli" title="Roadkill CLI"/>
        <TopicCard description="Expose Roadkill via the Model Context Protocol so LLMs can inspect pages and iteratively author tests." href="https://modelcontextprotocol.io/" title="MCP Integration"/>
    </TocPage>
</Root>`
        );

        const screenshot = await session.takeScreenshot();
        const dir = `dist/test/semantic-screenshot`;
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, "screenshot.png"), screenshot, { encoding: "base64" });
    }, 30000);
});
