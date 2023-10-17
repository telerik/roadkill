# Roadkill
> WebDriver for the Masses

***Version: Alpha! Not ready for use public adoption yet.***

A [node.js](https://nodejs.org/en) testing solution over the [WebDriver](https://www.w3.org/TR/webdriver2/) protocol. Will also consider [WebDriver BiDi](https://w3c.github.io/webdriver-bidi/).

Powered by:
 - [TypeScript](https://www.typescriptlang.org)
 - [Promise based](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
 - [Errors with causes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause)
 - [AbortSignals](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)
 - all the fancy tech...

A [WebDriver](https://www.w3.org/TR/webdriver2/) based slim testing framework. Closes the gaps between QAs and Front-End developers by:

 - Sharing the same TypeScript or JavaScript language with ***Angular***, ***React*** and ***Vue*** front-end developers
 - Stay within the [nodejs](https://nodejs.org/en) ecosystem
 - Skill-transfer between QAs and Front-End devs
 - Share the lightweight VSCode IDE
 - Compile-time type-checking

## jest-environment
The `@progress/roadkill` ships with a jest environment geared toward e2e.

To enable it set your jest environment in your jest config from the demo `package.json` to:
``` JSON
{
  "scripts": {
    "test": "node --experimental-vm-modules ../../node_modules/jest/bin/jest.js --detectOpenHandles --forceExit"
  },
  "jest": {
    "preset": "ts-jest/presets/default-esm",
    "testEnvironment": "@progress/roadkill/jest-environment.ts",
  }
}
```

The output will be printed on-the-go, and the `console.log` mocking will be disabled.

On test start and test done console.group will be put on stack, so console.logs could be easily referenced to a particular test.

Errors will be logged out with complete stack at the time of their appearance.

The environment also adds support to detect test and hook state. Use `@progress/roadkill/utils.ts` to import `getState()`, that gives a test or hook bound `signal` that is fired before timeout. It also allows us to write up cleanup on fail:

``` TypeScript
import { getState } from "@progress/roadkill/utils.js";

afterEach(async () => {
    const { signal, test, hook } = getState();
    if (test && test.status == "fail") {
        console.log("post-mortem collecting test failure artifacts for: " + test.names.join(" > "));
        // For example try to capture screenshot from session...
    }
});
```

Example test run output log:
```
Test Run
  Run
    w3schools
      - w3schools > navigate to js statements page ... , at w3schools.test.ts:41:5
        WebDriverMethodError: Failed to click element.
            at Element.click (/Users/cankov/git/telerik/roadkill/packages/@progress/roadkill/webdriver.ts:1308:19)
            at processTicksAndRejections (node:internal/process/task_queues:95:5)
            ... 2 lines matching cause stack trace ...
            at processTimers (node:internal/timers:507:7)
            at Object.<anonymous> (/Users/cankov/git/telerik/roadkill/examples/jest-web/w3schools.test.ts:55:9) {
          [cause]: WebDriverRequestError: WebDriver API call failed.
              at WebDriverClient.request (/Users/cankov/git/telerik/roadkill/packages/@progress/roadkill/webdriver.ts:537:76)
              at processTicksAndRejections (node:internal/process/task_queues:95:5)
              ... 2 lines matching cause stack trace ...
              at processTimers (node:internal/timers:507:7)
              at Element.click (/Users/cankov/git/telerik/roadkill/packages/@progress/roadkill/webdriver.ts:1306:20)
              at Object.<anonymous> (/Users/cankov/git/telerik/roadkill/examples/jest-web/w3schools.test.ts:55:9) {
            address: 'http://localhost:5027',
            command: 'POST /session/fb44c2e79fd1887be5d08a9be3374455/element/3D083E2E34E065F985F036327C7A6530_element_12/click',
            sessionId: 'fb44c2e79fd1887be5d08a9be3374455',
            elementId: '3D083E2E34E065F985F036327C7A6530_element_12',
            [cause]: TestTimeout [Error]: Exceeded timeout of 20000 ms for a test.
                at Object.fetch (node:internal/deps/undici/undici:14062:11)
                at processTicksAndRejections (node:internal/process/task_queues:95:5)
                at runNextTicks (node:internal/process/task_queues:64:3)
                at listOnTimeout (node:internal/timers:533:9)
                at processTimers (node:internal/timers:507:7)
                at WebDriverClient.request (/Users/cankov/git/telerik/roadkill/packages/@progress/roadkill/webdriver.ts:525:30)
                at Element.click (/Users/cankov/git/telerik/roadkill/packages/@progress/roadkill/webdriver.ts:1306:20)
                at Object.<anonymous> (/Users/cankov/git/telerik/roadkill/examples/jest-web/w3schools.test.ts:55:9)
          }
        }
      ✗ w3schools > navigate to js statements page (20.041sec.)
      ◯ w3schools > pending test, at w3schools.test.ts:65:10
      ✗ w3schools > timeouted test (205ms.), at w3schools.test.ts:68:5
        Error: Delay was aborted.
            at delay (/Users/cankov/git/telerik/roadkill/packages/@progress/roadkill/utils.ts:33:15)
            at runNextTicks (node:internal/process/task_queues:60:5)
            at listOnTimeout (node:internal/timers:533:9)
            at processTimers (node:internal/timers:507:7)
            at Object.<anonymous> (/Users/cankov/git/telerik/roadkill/examples/jest-web/w3schools.test.ts:69:9) {
          [cause]: TestTimeout [Error]: Exceeded timeout of 200 ms for a test.
              at Timeout._onTimeout (/Users/cankov/git/telerik/roadkill/packages/@progress/roadkill/jest-environment.ts:527:42)
              at listOnTimeout (node:internal/timers:564:17)
              at processTimers (node:internal/timers:507:7)
        }
      - afterAll, at w3schools.test.ts:30:5
        post-mortem collecting test failure artifacts for: w3schools > timeouted test
      ✓ afterAll
      ✗ afterAll, at w3schools.test.ts:38:5
        WebDriverRequestError: WebDriver API call failed.
            at WebDriverClient.request (/Users/cankov/git/telerik/roadkill/packages/@progress/roadkill/webdriver.ts:537:76)
            at processTicksAndRejections (node:internal/process/task_queues:95:5)
            ... 2 lines matching cause stack trace ...
            at processTimers (node:internal/timers:507:7)
            at Object.<anonymous> (/Users/cankov/git/telerik/roadkill/examples/jest-web/w3schools.test.ts:38:26) {
          address: 'http://localhost:5027',
          command: 'DELETE /session/fb44c2e79fd1887be5d08a9be3374455',
          sessionId: 'fb44c2e79fd1887be5d08a9be3374455',
          [cause]: HookTimeout [Error]: Exceeded timeout of 5000 ms for a hook.
              at Object.fetch (node:internal/deps/undici/undici:14062:11)
              at processTicksAndRejections (node:internal/process/task_queues:95:5)
              at runNextTicks (node:internal/process/task_queues:64:3)
              at listOnTimeout (node:internal/timers:533:9)
              at processTimers (node:internal/timers:507:7)
              at WebDriverClient.request (/Users/cankov/git/telerik/roadkill/packages/@progress/roadkill/webdriver.ts:525:30)
              at Object.<anonymous> (/Users/cankov/git/telerik/roadkill/examples/jest-web/w3schools.test.ts:38:26)
        }
```