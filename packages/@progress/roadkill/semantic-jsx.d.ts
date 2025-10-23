import { SemanticObject } from "./semantic.js";
import type { Session } from "./webdriver.js";
/**
 * Classic JSX factory:
 * <Foo a="b" /> -> SemanticJSX.createElement(Foo, { a: "b" }, ...)
 */
export declare namespace SemanticJSX {
    type Element = SemanticObject;
    function createElement(type: new (session?: Session) => SemanticObject, props: Record<string, unknown> | null, ...children: unknown[]): SemanticObject;
}
type Primitiveish = string | number | boolean | null | undefined;
type PrimitiveArray = ReadonlyArray<Primitiveish> | Primitiveish[];
type AllowedValue<T> = T extends Primitiveish ? T : T extends PrimitiveArray ? T : never;
type ExcludedKeys = "element" | "session" | "children";
type AllowedKeysOf<T> = {
    [K in keyof T]-?: K extends ExcludedKeys ? never : T[K] extends (...args: unknown[]) => unknown ? never : AllowedValue<T[K]> extends never ? never : K;
}[keyof T];
type PropsOf<C> = C extends new (session?: Session) => SemanticObject ? Partial<Pick<InstanceType<C>, AllowedKeysOf<InstanceType<C>>>> : never;
type WithChildren<P> = P & {
    children?: SemanticObject | ReadonlyArray<SemanticObject>;
};
declare global {
    namespace JSX {
        type Element = SemanticObject;
        interface ElementChildrenAttribute {
            children: {};
        }
        type LibraryManagedAttributes<C, P> = C extends new (session?: Session) => SemanticObject ? WithChildren<PropsOf<C>> : P;
    }
}
export {};
/** Compare two SemanticObject trees — expected first, actual second. */
export declare function semanticEqual(expected: SemanticObject, actual: SemanticObject): {
    ok: boolean;
    diff: string[];
};
/** Throw if trees don’t match. Order: expected, actual. */
export declare function expectSemanticMatch(actual: SemanticObject, expected: SemanticObject): void;
