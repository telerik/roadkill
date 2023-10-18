import { describe, test, expect } from "@jest/globals";
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
});