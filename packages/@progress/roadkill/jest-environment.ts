import NodeEnvironment from "jest-environment-node";
import consoleModule from "console";
import { relative } from "path";

/**
 * Formats duration given in milliseconds to user friendly string.
 * Tests run in seconds usually so for ranges:
 * 0 to 999ms - will print "XXXms"
 * 1 sec to 60 sec - will print "SS.XXX sec."
 * 60+ sec - will print "MM:SS.XXX min."
 */
function formatDuration(duration: number) {

    const milliseconds = duration % 1000;
    const seconds = Math.floor(duration / 1000) % 60;
    const minutes = Math.floor(duration / 60000);

    let format = "";

    let printedMs = false;
    if (duration < 1000) {
        format = milliseconds.toString() + " ms.";
        printedMs = true;
    } else if (duration >= 1000 && duration < 10000) {
        if (milliseconds >= 0 && milliseconds <= 9) {
            format = "00" + milliseconds.toString();
            printedMs = true;
        } else if (milliseconds >= 10 && milliseconds <= 99) {
            format = "0" + milliseconds.toString();
            printedMs = true;
        } else {
            format = milliseconds.toString();
            printedMs = true;
        }
    } else {
        // For more than 10 seconds task, don't print milliseconds...
    }

    if (duration >= 1000) {
        if (duration >= 60000) {
            if (seconds >= 0 && seconds <= 9) {
                format = "0" + seconds.toString() + (printedMs ? "." + format : "");
            } else {
                format = seconds.toString() + (printedMs ? "." + format : "");
            }
        } else {
            format = seconds.toString() + (printedMs ? "." + format : "") + " sec.";
        }
    }

    if (duration >= 60000) {
        format = minutes.toString() + ":" + format + " min.";
    }

    return format;
}

const color = process.env.FORCE_COLOR || (!process.env.NO_COLOR);
const gray = color ? (text: string) => `\x1b[90m${text}\x1b[0m` : (text: string) => text;
const green = color ? (text: string) => `\x1b[32m${text}\x1b[0m` : (text: string) => text;
const red = color ? (text: string) => `\x1b[31m${text}\x1b[0m` : (text: string) => text;

abstract class Scope {

    static scopes: Scope[] = [];
    static consoleLog;
    static scopeLog = function () {
        Scope.flush();
        consoleModule.log(...arguments);
    };

    static flush(to: Scope = undefined) {
        if (Scope.consoleLog != undefined) {
            consoleModule.log = Scope.consoleLog;
            Scope.consoleLog = undefined;
        }

        for (const scope of Scope.scopes) {
            if (!scope.beginPrinted) {
                scope.beginPrinted = true;
                consoleModule.group(`${scope}`);
            }

            if (to == scope) {
                Scope.consoleLog = consoleModule.log;
                consoleModule.log = Scope.scopeLog;
                break;
            }
        }
    }

    protected beginPrinted = false;
    protected endPrinted = false;

    constructor(
        protected readonly parent: Scope,
        protected readonly name: string) {
    }

    static get top(): Scope {
        if (this.scopes.length == 0) {
            return undefined;
        } else {
            return this.scopes[this.scopes.length - 1];
        }
    }

    static pop(): Scope {
        Scope.top.end();
        return Scope.scopes.pop();
    }

    begin() {
        Scope.scopes.push(this);

        if (consoleModule.log != Scope.scopeLog) {
            Scope.consoleLog = consoleModule.log;
            consoleModule.log = Scope.scopeLog;
        }
    }

    event() {
        consoleModule.log(`${this}`);
    }
    
    end() {
        if (Scope.scopes[Scope.scopes.length - 1] != this) {
            throw new Error("Scope begin/end mismatch.");
        }
        if (this.beginPrinted) {
            consoleModule.groupEnd();
            this.endPrinted = true;
        }
    }

    toString() { return this.name }
}

class RootScope extends Scope {
    constructor() {
        super(undefined, "Test");
    }
}

class SetupScope extends Scope {
    constructor(parent: RootScope) {
        super(parent, "Setup");
    }
}

class RunScope extends Scope {
    constructor(parent: RootScope) {
        super(parent, "Run");
    }
}

class DescribeScope extends Scope {
}

export interface HookState {
    readonly names: ReadonlyArray<string>;
    readonly fullName: string;
    readonly hookName: string;
    readonly status: "started" | "fail" | "pass";
    readonly error?: Error;
}

class FunctionScope extends Scope {

    public readonly names: ReadonlyArray<string>;
    public readonly source: string;
    
    private sourcePrinted = false;
    private startTime: number;

    constructor(parent: Scope, name: string, source: string, names: string[]) {
        super(parent, name);
        this.source = source;
        this.names = [...names, name];
    }

    override begin() {
        this.startTime = Date.now();
        super.begin();
    }

    protected formatSource(): string {
        if (this.sourcePrinted) return "";
        this.sourcePrinted = true;
        try {
            const base = process.env.INIT_CWD;
            return gray(", at " + relative(base, this.source));
        } catch {
            return gray(", at " + this.source);
        }
    }

    protected duration() {
        return ` (${formatDuration(Date.now() - this.startTime)})`;
    }
}


class HookScope extends FunctionScope implements HookState {
    private _error: Error;
    private _status: "started" | "fail" | "pass" = "started";
    private conclusionPrinted = false;
    private beginWithDotDotDot = false;

    private beginTimeout: NodeJS.Timeout;
    private onTimeout: () => void;

    public get status() { return this._status; }
    public get error() { return this.error; }
    public get fullName() { return this.names.join(" "); }
    public get hookName() { return this.names[this.names.length - 1]; }

    override begin(): void {
        super.begin();
        this.onTimeout = () => {
            this.beginWithDotDotDot = true;
            this.beginTimeout = undefined;
            Scope.flush(this);
        };
        // If a test takes more than 10000, print its opening so devs have some sense of progress
        this.beginTimeout = setTimeout(this.onTimeout, 10000);
    }

    fail(error: Error = undefined) {
        this._status = "fail";
        this._error = error;
        if (this._error) {
            consoleModule.log(error);
        }
    }

    pass() {
        this._status = "pass";
    }

    override end() {
        if (this.beginTimeout != undefined) clearTimeout(this.beginTimeout);
        if (!this.conclusionPrinted && this.beginPrinted) {
            Scope.flush();
        }
        super.end();
        if (!this.conclusionPrinted && this.beginPrinted) {
            consoleModule.log(`${this}`);
        }
    }

    toString(): string {
        switch (this._status) {
            case "started":
                return `${gray("○")} ${this.name}${this.formatSource()}`;
            case "pass":
                this.conclusionPrinted = true;
                return `${green("✓")} ${this.name}${this.duration()}${this.formatSource()}`;
            case "fail":
                this.conclusionPrinted = true;
                return `${red("✗")} ${this.name}${this.duration()}${this.formatSource()}`;
        }
    }
}

export interface TestState {
    readonly names: ReadonlyArray<string>;
    readonly fullName: string;
    readonly testName: string;
    readonly status: "started" | "fail" | "pass" | "skip";
    readonly error?: Error;
}

class TestScope extends FunctionScope implements TestState {

    private _error: Error;
    private _status: "started" | "fail" | "pass" = "started";
    private conclusionPrinted = false;
    private beginWithDotDotDot = false;

    private beginTimeout: NodeJS.Timeout;
    private onTimeout: () => void;

    public get status() { return this._status; }
    public get error() { return this.error; }
    public get fullName() { return this.names.join(" "); }
    public get testName() { return this.names[this.names.length - 1]; }

    override begin(): void {
        super.begin();
        this.onTimeout = () => {
            this.beginWithDotDotDot = true;
            this.beginTimeout = undefined;
            Scope.flush(this);
        };
        // If a test takes more than 10000, print its opening so devs have some sense of progress
        this.beginTimeout = setTimeout(this.onTimeout, 10000);
    }

    fail(error: Error = undefined) {
        this._status = "fail";
        this._error = error;
        if (this._error) {
            consoleModule.log(error);
        }
    }

    pass() {
        this._status = "pass";
    }

    override end() {
        if (this.beginTimeout != undefined) clearTimeout(this.beginTimeout);
        if (!this.conclusionPrinted) {
            Scope.flush();
        }
        super.end();
        if (!this.conclusionPrinted) {
            consoleModule.log(`${this}`);
        }
    }

    toString(): string {
        switch (this._status) {
            case "started": 
                return `${gray("○")} ${this.name}${ this.beginWithDotDotDot ? " ... " : ""}${this.formatSource()}`;
            case "pass":
                this.conclusionPrinted = true;
                return `${green("✓")} ${this.name}${this.duration()}${this.formatSource()}`;
            case "fail":
                this.conclusionPrinted = true;
                return `${red("✗")} ${this.name}${this.duration()}${this.formatSource()}`;
        }
    }
}

class TestSkip extends Scope implements TestState {

    public readonly names: ReadonlyArray<string>;
    private readonly source: string;
    private sourcePrinted = false;
    private _status: "skip" = "skip";

    constructor(parent: Scope, name: string, source: string, names: string[]) {
        super(parent, name);
        this.names = names;
        this.source = source;
    }
    
    public get status() { return this._status; }
    public get error() { return this.error; }
    public get fullName() { return this.names.join(" "); }
    public get testName() { return this.names[this.names.length - 1]; }

    toString() {
        return `\x1b[90m◯\x1b[0m ${this.name}${this.formatSource()}`;
    }

    formatSource(): string {
        if (this.sourcePrinted) return "";
        this.sourcePrinted = true;
        try {
            const base = process.env.INIT_CWD;
            return gray(", at " + relative(base, this.source));
        } catch {
            return gray(", at " + this.source);
        }
    }
}

class TeardownScope extends Scope {
    constructor(parent: RootScope) {
        super(parent, "Teardown");
    }
}

// Type checking is broken
const BaseEnvironment = (NodeEnvironment as any);

class TestTimeout extends Error {}
class HookTimeout extends Error {}

class TestEnvironment extends BaseEnvironment {

    constructor(config, context) {
        super(config, context);
    }

    private static getNameStack(event) {

        let nameStack: string[] = [];

        if (event?.test?.name) {
            nameStack.push(event.test.name);
        } else if (event?.describeBlock?.name && event?.describeBlock.name != "ROOT_DESCRIBE_BLOCK") {
            nameStack.push(event.describeBlock.name);
        }

        let parent = event?.test?.parent || event?.describeBlock?.parent || event?.hook?.parent;
        while (parent && parent?.name != "ROOT_DESCRIBE_BLOCK") {
            nameStack.unshift(parent.name);
            parent = parent.parent;
        }

        return nameStack;
    }

    private displayFriendlyEventName(name: string) {
        switch(name) {
            case "setup": return "Setup";
            case "add_hook": return "Add hook";
            case "add_test": return "Add test";
            case "start_describe_definition": return "Start describe definition";
            case "finish_describe_definition": return "Finish describe definition";
            case "run_start": return "Run Start";
            case "run_describe_start": return "Run describe start";
            case "hook_start": return "Hook start";
            case "hook_success": return "Hook success";
            case "test_start": return "Test start";
            case "test_skip": return "Test skipped";
            case "test_started": return "Test started";
            case "test_fn_start": return "Test function started";
            case "test_fn_failure": return "Test function failure";
            case "test_fn_success": return "Test function success";
            case "test_done": return "Test done";
            case "run_describe_finish": return "Run describe finish";
            case "run_finish": return "Run finish";
            case "teardown": return "Teardown";
            default: return name;
        }
    }

    private hookName(event): string {
        return event?.hook?.type;
    }

    private source(event): string {
        try {
            const hookStack = event?.hook?.asyncError?.stack || event?.test?.asyncError?.stack;
            const stackLines = hookStack.split("\n");
            if (stackLines.length >= 2) {
                const line: string = stackLines[1]?.trim();

                let path: string;
                
                let openBrace = line.indexOf("(");
                let closeBrace = line.indexOf(")");

                if (openBrace != -1 && closeBrace != -1 && openBrace < closeBrace) {
                    // at _dispatchDescribe (/Users/cankov/git/telerik/roadkill/node_modules/jest-circus/build/index.js:91:26)
                    path = line.substring(openBrace + 1, closeBrace - 1);
                } else if (line.startsWith("at ")) {
                    // at /Users/cankov/git/telerik/roadkill/examples/jest-web/w3schools.test.ts:41:5
                    path = line.substring(3);
                } else {
                    // play safe
                    path = line;
                }

                return path;
            }
        } catch(e) {
            return undefined;
        }
    }

    async handleTestEvent(event, state) {

        const nameStack = TestEnvironment.getNameStack(event);

        if (event.name == "setup" && this.global.roadkillJestConsoleDefault !== false) {
            this.global.console = consoleModule;
        }

        if (this.global.roadkillJestLifecycleLogging) {
            console.log(`[JEST] ${this.displayFriendlyEventName(event.name)}${event?.hook?.type ? " " + event?.hook?.type : ""}${nameStack.length ? " (" + nameStack.join(" > ") + ")" : ""}`);
        }

        if (event.error && event.name != "test_fn_failure" && event.name != "hook_failure") {
            consoleModule.log(event.error);
        }

        if (event.name == "setup") {
            new RootScope().begin();
            new SetupScope(Scope.top).begin();
        } else if (event.name == "run_start") {
            Scope.pop(); // Pops Setup
            new RunScope(Scope.top).begin();
        } else if (event.name == "run_describe_start") {
            if (event.describeBlock.name == "ROOT_DESCRIBE_BLOCK") {
            } else {
                new DescribeScope(Scope.top, nameStack.join(" > ")).begin();
            }
        } else if (event.name == "hook_start") {
            const hookScope = new HookScope(
                Scope.top,
                this.hookName(event),
                this.source(event),
                nameStack);
            this.global["@progress/roadkill/utils:hook"] = hookScope;
            hookScope.begin();
        } else if (event.name == "hook_success") {
            (Scope.top as HookScope).pass();
            Scope.pop();
        } else if (event.name == "hook_failure") {
            (Scope.top as HookScope).fail(event.error);
            Scope.pop();
        } else if (event.name == "test_started") {
            const testScope = new TestScope(
                Scope.top,
                nameStack.join(" > "),
                this.source(event),
                nameStack);
            this.global["@progress/roadkill/utils:test"] = testScope;
            testScope.begin();
        } else if (event.name == "test_fn_failure") {
            const test = Scope.top as TestScope;
            test.fail(event.error);
        } else if (event.name == "test_fn_success") {
            const test = Scope.top as TestScope;
            test.pass();
        } else if (event.name == "test_done") {
            const test = (Scope.top as TestScope);
            if (test.status == "started") {
                test.fail();
            }
            Scope.pop();
        } else if (event.name == "test_skip") {
            const testScope = new TestSkip(
                Scope.top,
                nameStack.join(" > "),
                this.source(event),
                nameStack).event();
        } else if (event.name == "run_describe_finish") {
            if (event.describeBlock.name == "ROOT_DESCRIBE_BLOCK") {
            } else {
                Scope.pop();
            }
        } else if (event.name == "run_finish") {
            Scope.pop();
        } else if (event.name == "teardown") {
            Scope.pop();
        }
        
        switch (event.name) {
            case 'test_start':
                break;
            case 'test_fn_start':
                this.global["@progress/roadkill/utils:signal"] = undefined;
                this.global.signal = undefined;
                const testTimeout = (event?.test?.timeout ?? state?.testTimeout);
                if (testTimeout != undefined) {
                    const controller = new AbortController();
                    this.global["@progress/roadkill/utils:signal"] = controller.signal;
                    this.global.signal = controller.signal;
                    setTimeout(() => {
                        controller.abort(new TestTimeout(`Exceeded timeout of ${testTimeout} ms for a test.`));
                    }, Math.max(0, testTimeout));
                }
                break;
            case 'hook_start':
                this.global["@progress/roadkill/utils:signal"] = undefined;
                this.global.signal = undefined;
                const hookTimeout = (event?.hook?.timeout ?? state?.testTimeout);
                if (hookTimeout) {
                    const controller = new AbortController();
                    this.global["@progress/roadkill/utils:signal"] = controller.signal;
                    this.global.signal = controller.signal;
                    setTimeout(() => {
                        controller.abort(new HookTimeout(`Exceeded timeout of ${hookTimeout} ms for a hook.`));
                    }, Math.max(0, hookTimeout));
                }
                break;
            case 'test_done':
                break;
        }
    }
}

export default TestEnvironment;
