import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { formatDuration } from "./utils.js";

describe("utils", () => {
    describe("formatDuration", () => {
        test("0 ms.", () => expect(formatDuration(0)).toEqual("0 ms."));
        test("9 ms.", () => expect(formatDuration(9)).toEqual("9 ms."));
        test("12 ms.", () => expect(formatDuration(12)).toEqual("12 ms."));
        test("1.000 sec.", () => expect(formatDuration(1000)).toEqual("1.000 sec."));
        test("1.006 sec.", () => expect(formatDuration(1006)).toEqual("1.006 sec."));
        test("1.015 sec.", () => expect(formatDuration(1015)).toEqual("1.015 sec."));
        test("1.111 sec.", () => expect(formatDuration(1111)).toEqual("1.111 sec."));
        test("1:00.000 min.", () => expect(formatDuration(60000)).toEqual("1:00 min."));
        test("1:01.000 min.", () => expect(formatDuration(61000)).toEqual("1:01 min."));
        test("1:01.020 min.", () => expect(formatDuration(61020)).toEqual("1:01 min."));
        test("1:10.000 min.", () => expect(formatDuration(70000)).toEqual("1:10 min."));
        test("1:10.123 min.", () => expect(formatDuration(70123)).toEqual("1:10 min."));
    });

    describe("resource management patterns", () => {
        test("per-test automatic cleanup (recommended)", async () => {
            // This pattern uses ECMAScript disposables for automatic cleanup
            const mockClient = {
                async session() {
                    return {
                        async navigate() { return "navigated"; },
                        async [Symbol.asyncDispose]() { /* session disposed automatically */ }
                    };
                }
            };
            
            await using session = await mockClient.session();
            const result = await session.navigate();
            expect(result).toBe("navigated");
            // session automatically disposed when test completes
        });

        // Example of beforeAll/afterAll pattern
        let sharedResource: { [Symbol.asyncDispose](): Promise<string> } | null = null;

        beforeAll(async () => {
            // When constructed in beforeAll, manual disposal is required
            sharedResource = {
                async [Symbol.asyncDispose]() { return "ECMAScript 2024 disposal complete!"; }
            };
        });

        afterAll(async () => {
            // ECMAScript 2024 symbol-based disposal
            const result = await sharedResource?.[Symbol.asyncDispose]();
            expect(result).toBe("ECMAScript 2024 disposal complete!");
        });

        test("suite-level manual cleanup (when needed)", async () => {
            expect(sharedResource).toBeTruthy();
            // Resource will be manually disposed in afterAll
        });
    });
});