import { SemanticObject } from "./semantic.js";

/**
 * Classic JSX factory:
 * <Foo a="b" /> -> SemanticJSX.createElement(Foo, { a: "b" }, ...)
 */
export namespace SemanticJSX {
    export type Element = SemanticObject;

    const RESERVED = new Set(["children", "element", "session"]);
    const isReserved = (k: string) => RESERVED.has(k);

    function definePropsFromRecord(node: SemanticObject, rec: Record<string, unknown>) {
        for (const [k, v] of Object.entries(rec)) {
            if (isReserved(k)) continue;
            if (typeof v === "function") continue;
            if (Object.prototype.hasOwnProperty.call(node, k)) continue;
            Object.defineProperty(node, k, {
                value: v,
                writable: false,
                enumerable: true,
                configurable: true,
            });
        }
    }

    export function createElement(
        type: new () => SemanticObject,
        props: Record<string, unknown> | null,
        ...children: unknown[]
    ): SemanticObject {
        const node = new type();

        if (props) definePropsFromRecord(node, props);

        (node as any).children = children
            .flat()
            .filter((c): c is SemanticObject => c instanceof SemanticObject);

        return node;
    }
}

// Strong JSX prop typing from instance type (with children)

type Primitiveish = string | number | boolean | null | undefined;
type PrimitiveArray = ReadonlyArray<Primitiveish> | Primitiveish[];
type AllowedValue<T> =
    T extends Primitiveish ? T :
    T extends PrimitiveArray ? T :
    never;

type ExcludedKeys = "element" | "session" | "children";
type AllowedKeysOf<T> = {
    [K in keyof T]-?:
    K extends ExcludedKeys ? never :
    T[K] extends (...args: any[]) => any ? never :
    AllowedValue<T[K]> extends never ? never : K
}[keyof T];

type PropsOf<C> =
    C extends new (...args: any[]) => any
    ? Partial<Pick<InstanceType<C>, AllowedKeysOf<InstanceType<C>>>>
    : never;

type WithChildren<P> = P & {
    children?: SemanticObject | ReadonlyArray<SemanticObject>;
};

declare global {
    namespace JSX {
        type Element = SemanticObject;
        interface ElementChildrenAttribute { children: {}; }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        type LibraryManagedAttributes<C, P> =
            C extends new (...args: any[]) => SemanticObject
            ? WithChildren<PropsOf<C>>
            : P;
    }
}

export { }; // keep module

// Assert / Compare helpers

function isPrimitiveish(v: unknown): v is Primitiveish {
    return v == null || ["string", "number", "boolean"].includes(typeof v as string);
}
function isPrimitiveArray(v: unknown): v is PrimitiveArray {
    return Array.isArray(v) && v.every(isPrimitiveish);
}

function pickSerializableProps(node: SemanticObject): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as any)) {
        if (k === "children" || k === "element" || k === "session") continue;
        if (v == null) { out[k] = v; continue; }
        const t = typeof v;
        if (t === "string" || t === "number" || t === "boolean") { out[k] = v; continue; }
        if (Array.isArray(v) && v.every(x => x == null || ["string", "number", "boolean"].includes(typeof x))) {
            out[k] = v; continue;
        }
    }
    return out;
}

function classNameOf(node: SemanticObject): string {
    return (node as any)?.constructor?.name || "<Unknown>";
}

function diffProps(path: string, a: Record<string, unknown>, b: Record<string, unknown>): string[] {
    const diffs: string[] = [];
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
        const av = a[k];
        const bv = b[k];
        const same =
            (isPrimitiveish(av) && isPrimitiveish(bv) && av === bv) ||
            (isPrimitiveArray(av) && isPrimitiveArray(bv) && av.length === bv.length && av.every((v, i) => v === bv[i]));
        if (!same) {
            diffs.push(`${path}: prop "${k}" differs: ${JSON.stringify(av)} !== ${JSON.stringify(bv)}`);
        }
    }
    return diffs;
}

/** Compare two SemanticObject trees — expected first, actual second. */
export function semanticEqual(expected: SemanticObject, actual: SemanticObject): { ok: boolean; diff: string[] } {
    const diffs: string[] = [];

    function walk(e: SemanticObject, a: SemanticObject, path: string) {
        const eName = classNameOf(e);
        const aName = classNameOf(a);
        if (eName !== aName) { diffs.push(`${path}: type differs: ${eName} !== ${aName}`); return; }

        const eProps = pickSerializableProps(e);
        const aProps = pickSerializableProps(a);
        diffs.push(...diffProps(`${path}<${eName}>`, eProps, aProps));

        const eKids = e.children ?? [];
        const aKids = a.children ?? [];
        if (eKids.length !== aKids.length) {
            diffs.push(`${path}<${eName}>: children count differs: ${eKids.length} !== ${aKids.length}`);
        }
        const count = Math.min(eKids.length, aKids.length);
        for (let i = 0; i < count; i++) {
            walk(eKids[i], aKids[i], `${path}/${eName}[${i}]`);
        }
    }

    walk(expected, actual, "");
    return { ok: diffs.length === 0, diff: diffs };
}

/** Throw if trees don’t match. Order: expected, actual. */
export function expectSemanticMatch(actual: SemanticObject, expected: SemanticObject): void {
    const { ok, diff } = semanticEqual(expected, actual);
    if (!ok) throw new Error(["Semantic trees differ:", ...diff.map(d => `  - ${d}`)].join("\n"));
}
