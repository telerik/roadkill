// import type { Reporter as JestReporter } from "@jest/reporters";

class Reporter {
    onTestCaseStart(test, testCaseStartInfo) {
        // console.log(`[JEST] TEST ${testCaseStartInfo.fullName}`);
    }
    onTestCaseResult(test, testCaseResult) {
        console.log(`[JEST] ${testCaseResult.status.toUpperCase()} (${testCaseResult.title}) in ${testCaseResult.duration}ms.`);
        if (testCaseResult.failureMessages) {
            for(const message of testCaseResult.failureMessages) {
                console.log("    " + message.split("\n").join("    \n"));
            }
        }
    }
}

module.exports = Reporter;

// export default Reporter;