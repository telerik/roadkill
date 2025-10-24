import { Session, type Element as WebDriverElement } from "@progress/roadkill/webdriver";
type FinderSrc = {
    name: string;
    src: string;
};
export declare function semantic(): <T extends SemanticCtor<SemanticObject>>(ctor: T) => T;
export declare function getFinders(): FinderSrc[];
/** Base class: exposes hydrated WebDriver element and children. */
export declare class SemanticObject {
    readonly session?: Session;
    readonly children: SemanticObject[];
    element?: WebDriverElement | null;
    constructor(session?: Session);
    childrenOfType<T extends SemanticObject>(ctor: new (session?: Session) => T): T[];
    private static pickSerializableProps;
    toJSON(): any;
    toXML(indent?: undefined | string): string;
}
export declare class Root extends SemanticObject {
}
export interface SemanticCtor<T extends SemanticObject> {
    new (session?: Session): T;
    semanticClass?: string;
    find(): Array<{
        element: globalThis.Element;
        [k: string]: any;
    }>;
}
type ElementOf<T> = T extends (infer U)[] ? U : never;
type HydrateElements<T> = T extends globalThis.Element ? WebDriverElement : T extends (infer U)[] ? HydrateElements<U>[] : T extends object ? {
    [K in keyof T]: HydrateElements<T[K]>;
} : T;
export type DTO<T extends object = {}> = {
    element: globalThis.Element;
} & T;
export type AnnotatedDTO<T> = HydrateElements<T> & {
    ["$semantic-class"]: string;
    element?: globalThis.Element;
    children?: Array<AnnotatedDTO<unknown>>;
};
export type DTOOf<C extends {
    find: (...args: any[]) => any;
}> = AnnotatedDTO<ElementOf<ReturnType<C["find"]>>>;
export declare function buildDiscoverScript(): string;
/** Hydrate a DTO forest (from browser) into a Root tree. */
export declare function hydrate(session: Session, dtoRoots: Array<AnnotatedDTO<unknown>>): Root;
/** Discover: build - execute - hydrate (no debug logging). */
export declare function discover(session: Session): Promise<Root>;
/** Browser-side helper, re-exported for user finders. */
export declare function findElementsByCss<T extends object = {}>(selector: string, mapFn: (el: globalThis.Element) => T | undefined): Array<{
    element: globalThis.Element;
} & Omit<T, "element">>;
type RuntimeKeys = "children" | "element" | "session";
type Primitiveish = string | number | boolean | null | undefined;
type ToFinderValue<T> = T extends WebDriverElement | null | undefined ? (Element | null) : T extends readonly (infer U)[] ? ReadonlyArray<ToFinderValue<U>> : T extends (infer U)[] ? ToFinderValue<U>[] : T extends object ? {
    [K in keyof T]: ToFinderValue<T[K]>;
} : T extends Primitiveish ? T : never;
type AllowedDTOKeysOf<T> = {
    [K in keyof T]-?: K extends RuntimeKeys ? never : T[K] extends (...args: any[]) => any ? never : [
        ToFinderValue<T[K]>
    ] extends [never] ? never : K;
}[keyof T];
/**
 * The DTO shape produced by `find()` for a given class constructor.
 * - Always includes `element: Element`
 * - Includes only allowed instance props
 * - Converts WebDriverElement - Element (recursively)
 */
export type Find<Ctor extends new (...args: any[]) => SemanticObject> = {
    element: Element;
} & {
    [K in AllowedDTOKeysOf<InstanceType<Ctor>>]: ToFinderValue<InstanceType<Ctor>[K]>;
};
/** Convenience: fields-only part (without the required `element`), suitable for use in findElementsByCss */
export type FindByCSSFields<Ctor extends new (...args: any[]) => SemanticObject> = Omit<Find<Ctor>, "element">;
export {};
