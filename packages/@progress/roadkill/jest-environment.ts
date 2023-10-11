import NodeEnvironment from "jest-environment-node";
import consoleModule from "console";

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

        if (event?.test?.name) nameStack.push(event.test.name);
        if (event?.hook?.name && event?.hook?.name != "ROOT_DESCRIBE_BLOCK") nameStack.push(event.test.name);
        let parent = event?.test?.parent || event?.hook?.parent;
        while (parent && parent?.name != "ROOT_DESCRIBE_BLOCK") {
            nameStack.unshift(parent.name);
            parent = parent.parent;
        }
        return nameStack;
    }

    private displayFriendlyEventName(name: string) {
        switch(name) {
            case "setup": return undefined;
            case "add_hook": return undefined;
            case "add_test": return undefined;
            case "start_describe_definition": return undefined;
            case "finish_describe_definition": return undefined;
            case "run_start": return undefined;
            case "run_describe_start": return undefined;
            case "hook_start": return "Hook start";
            case "hook_success": return "Hook success";
            case "test_start": return "Test start";
            case "test_skip": return undefined;
            case "test_started": return undefined;
            case "test_fn_start": return "Test function started";
            case "test_fn_failure": return "Test function failure";
            case "test_done": return "Test done";
            case "run_describe_finish": return undefined;
            case "run_finish": return undefined;
            case "teardown": return undefined;
            default: return name;
        }
    }

    async handleTestEvent(event, state) {

        const nameStack = TestEnvironment.getNameStack(event);

        if (event.name == "setup" && this.global.roadkillJestConsoleDefault) {
            this.global.console = consoleModule;
        }

        if (process.env["GITHUB_ACTIONS"]) {
            if (event.name == "test_start") {
                console.log();
                console.log(`::group:: TEST ${nameStack?.join(" ")}`);
            }

            if (event.name == "test_done") {
                console.log(`::endgroup::`);
            }
        }

        if (this.global.roadkillJestLifecycleLogging) {
            const name = this.displayFriendlyEventName(event.name);
            if (name) console.log(`[JEST] ${this.displayFriendlyEventName(event.name)}${event?.hook?.type ? " " + event?.hook?.type : ""}${nameStack.length ? " (" + nameStack.join(" ") + ")" : ""}`);
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
                    }, Math.max(0, testTimeout - 500));
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
                    }, Math.max(0, hookTimeout - 500));
                }
                break;
            case 'test_done':
                break;
        }
    }
}

export default TestEnvironment;
