// index.semantic.test.ts
import { describe, test, expect, beforeAll, afterAll, afterEach, beforeEach } from "@jest/globals";
import { mkdir, writeFile } from "fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Express } from "@progress/roadkill/express.js";
import { getState, step } from "@progress/roadkill/utils.js";
import { ChromeDriver } from "@progress/roadkill/chromedriver.js";
import { Session, WebDriverClient, type Element as WebDriverElement } from "@progress/roadkill/webdriver.js";
import { semantic, discover, SemanticObject, Root, findElementsByCss, type DTO, type DTOOf } from "@progress/roadkill/semantic.js";

const enableLogging = false;

@semantic()
class LoginPage extends SemanticObject {
    public readonly titleText: string;
    private readonly userInput: WebDriverElement | null;
    private readonly passInput: WebDriverElement | null;
    private readonly submitBtn: WebDriverElement | null;

    static find(): Array<{
        element: Element;
        titleText: string;
        userInput: Element | null;
        passInput: Element | null;
        submitBtn: Element | null;
    }> {
        return findElementsByCss("main.page-login", el => {
            const title = el.querySelector("h1");
            return {
                element: el,
                titleText: (title?.textContent || "").trim(),
                userInput: el.querySelector("#username"),
                passInput: el.querySelector("#password"),
                submitBtn: el.querySelector("button[type=submit]"),
            };
        });
    }

    constructor(s: any, dto: DTOOf<typeof LoginPage>) {
        super(s, dto);
        this.titleText = dto.titleText;
        this.userInput = dto.userInput;
        this.passInput = dto.passInput;
        this.submitBtn = dto.submitBtn;
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
    static find(): DTO<{}>[] {
        return findElementsByCss("iframe.overlay-frame", () => ({}));
    }
    async switchToFrame() {
        await this.element!.switchToFrame();
    }
}

@semantic()
class GdprPanel extends SemanticObject {
    public readonly headerText: string;
    private readonly acceptBtn: WebDriverElement | null;

    static find(): DTO<{ headerText: string; acceptBtn: Element | null }>[] {
        return findElementsByCss("main.page-gdpr", element => ({
            headerText: (element.querySelector("h2")?.textContent || "").trim(),
            acceptBtn: element.querySelector("#accept"),
        }));
    }

    constructor(s: any, dto: DTOOf<typeof GdprPanel>) {
        super(s, dto);
        this.headerText = dto.headerText;
        this.acceptBtn = dto.acceptBtn;
    }

    async accept() {
        await this.acceptBtn!.click();
    }
}

// Topics page container (captures header + subtitle; becomes parent of TopicCard via containment)
@semantic()
class TocPage extends SemanticObject {
    public readonly titleText: string;
    public readonly subtitleText: string;
    public readonly cardCount: number;

    static find(): DTO<{ titleText: string; subtitleText: string; cardCount: number }>[] {
        return findElementsByCss("main.page-topics", element => ({
            titleText: (element.querySelector("h1")?.textContent || "").trim(),
            subtitleText: (element.querySelector(".muted")?.textContent || "").trim(),
            cardCount: element.querySelectorAll("#topics-grid .card").length,
        }));
    }

    constructor(session: any, dto: DTOOf<typeof TocPage>) {
        super(session, dto);
        this.titleText = dto.titleText;
        this.subtitleText = dto.subtitleText;
        this.cardCount = dto.cardCount;
    }

    cards(): TopicCard[] { return this.childrenOfType(TopicCard); }
}

@semantic()
class TopicCard extends SemanticObject {
    public readonly title: string;
    public readonly description: string;
    public readonly href: string;

    static find(): DTO<{ title: string; description: string; href: string }>[] {
        return findElementsByCss("#topics-grid .card", element => ({
            title: (element.querySelector("h3")?.textContent || "").trim(),
            description: (element.querySelector("p.muted")?.textContent || "").trim(),
            href: (element.querySelector("a[href]") as HTMLAnchorElement | null)?.href || "",
        }));
    }

    constructor(s: any, dto: DTOOf<typeof TopicCard>) {
        super(s, dto);
        this.title = dto.title;
        this.description = dto.description;
        this.href = dto.href;
    }
}

describe("test-website (semantic objects)", () => {
    let chromedriver: ChromeDriver;
    let express: Express;
    let webdriver: WebDriverClient;
    let session: Session;

    beforeAll(async () => {
        const { signal } = getState();

        express = new Express(
            Express.npmStart({ cwd: dirname(fileURLToPath(import.meta.url)), enableLogging }),
        );
        await express.start(signal);

        chromedriver = new ChromeDriver({ args: ["--port=5033"], enableLogging });
        await chromedriver.start(signal);

        webdriver = new WebDriverClient({ address: chromedriver.address!, enableLogging });
        session = await webdriver.newSession({
            capabilities: { timeouts: { implicit: 2000 } },
        });
    }, 60000);

    beforeEach(async () => {
        await session.setTimeouts({ implicit: 2000 });
    });

    afterEach(async () => {
        const { test } = getState();
        if (test && test.status === "fail") {
            const screenshot = await session.takeScreenshot();
            const dir = `dist/test/${expect.getState().currentTestName}-semantic`;
            await mkdir(dir, { recursive: true });
            await writeFile(join(dir, "screenshot.png"), screenshot, { encoding: "base64" });
        }
    });

    afterAll(async () => {
        await session?.dispose();
        await chromedriver?.dispose();
        await express?.dispose();
    }, 20000);

    test.only("login + topics using semantic objects", async () => {

        await step("navigate to local test site", () =>
            session.navigateTo(express.address!)
        );

        let root: Root = await step("discover login page + iframe", async () => {
            const r = await discover(session);
            expect(r.toXML("    ")).toBe(
                `<Root>
    <LoginPage titleText="Roadkill – Test Login">
        <GdprFrame/>
    </LoginPage>
</Root>`
            );
            return r;
        });

        await step("switch to GDPR iframe", async () => {
            const login = root.childrenOfType(LoginPage)[0];
            const frame = login.childrenOfType(GdprFrame)[0];
            expect(frame).toBeDefined();
            await frame.switchToFrame();
        });

        await step("discover & accept GDPR", async () => {
            const r = await discover(session);
            expect(r.toXML("    ")).toBe(
                `<Root>
    <GdprPanel headerText="GDPR Consent"/>
</Root>`
            );
            const panel = r.childrenOfType(GdprPanel)[0];
            await panel.accept();
        });

        await step("switch back & perform login", async () => {
            await session.switchToFrame(null);
            const r = await discover(session);
            const login = r.childrenOfType(LoginPage)[0];
            await login.login({ username: "admin", password: "1234" });
        });

        await step("wait for redirect to /toc", async () => {
            const deadline = Date.now() + 12_000;
            while (Date.now() < deadline) {
                if ((await session.getCurrentUrl()).includes("/toc")) return;
                await new Promise(r => setTimeout(r, 50));
            }
            throw new Error("Timed out waiting for /toc");
        });

        await step("discover topics & verify snapshot", async () => {
            const r = await discover(session);
            const xml = r.toXML("    ");
            expect(xml).toBe(
                `<Root>
    <TocPage cardCount="5" subtitleText="Targetable summary cards for QA flows." titleText="Roadkill – Topics">
        <TopicCard description="Standalone server implementing the WebDriver protocol for Chromium browsers. Roadkill manages lifecycle, logs, and startup detection." href="https://chromedriver.chromium.org/" title="ChromeDriver"/>
        <TopicCard description="The W3C-standard browser automation protocol. Roadkill stays close to spec with typed commands and helpful errors." href="https://www.w3.org/TR/webdriver2/" title="WebDriver"/>
        <TopicCard description="Higher-level DOM discovery helpers that make selectors readable, robust, and LLM-friendly." href="http://localhost:3000/toc#semantic-objects" title="Semantic Objects"/>
        <TopicCard description="Checks Chrome/Node/ChromeDriver versions, manages drivers, and streamlines CI/dev workflows." href="http://localhost:3000/toc#roadkill-cli" title="Roadkill CLI"/>
        <TopicCard description="Expose Roadkill via the Model Context Protocol so LLMs can inspect pages and iteratively author tests." href="https://modelcontextprotocol.io/" title="MCP Integration"/>
    </TocPage>
</Root>`
            );
        });

        await step("screenshot topics page", async () => {
            const screenshot = await session.takeScreenshot();
            const dir = `dist/test/${expect.getState().currentTestName}-semantic`;
            await mkdir(dir, { recursive: true });
            await writeFile(join(dir, "screenshot.png"), screenshot, { encoding: "base64" });
        });
    }, 30000);
});
