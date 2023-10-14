// import type { Reporter as JestReporter } from "@jest/reporters";

class Reporter {
    onTestCaseStart(test, testCaseStartInfo) {
        let nameStack = [...testCaseStartInfo.ancestorTitles, testCaseStartInfo.title];
        let name = '"' + nameStack.join('" > "') + '"';
        console.log(`[JEST] START: ${name}...`);
    }

    onTestCaseResult(test, testCaseResult) {

        let nameStack = [...testCaseResult.ancestorTitles, testCaseResult.title];
        let name = '"' + nameStack.join('" > "') + '"';

        console.log(`[JEST] ${testCaseResult.status.toUpperCase()}: ${name} (in ${testCaseResult.duration}ms.)`);

        if (testCaseResult.failureMessages) {
            for(const message of testCaseResult.failureMessages) {
                console.log("    " + message.split("\n").join("    \n"));
            }
        }
    }
}

module.exports = Reporter;