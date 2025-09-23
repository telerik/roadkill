import { Session, type Element as WebDriverElement } from "@progress/roadkill/webdriver.js";

type FinderSrc = { name: string; src: string };

class Registry {
    private readonly list: FinderSrc[] = [];
    private readonly ctors = new Map<string, SemanticCtor<any>>();
    register(ctor: SemanticCtor<any>) {
        const name = ctor?.name;
        const fn = (ctor as any)?.find;
        if (!name || typeof fn !== "function") {
            throw new Error(`@semantic: ${name || "<anonymous>"} must declare a static find() function`);
        }
        (ctor as any).semanticClass = name;
        this.list.push({ name, src: fn.toString() });
        this.ctors.set(name, ctor);
    }
    payload(): FinderSrc[] { return this.list.slice(); }
    ctorOf(name: string) { return this.ctors.get(name); }
}
const registry = new Registry();

export function semantic() {
    return function <T extends new (...args: any[]) => any>(ctor: T) {
        registry.register(ctor as unknown as SemanticCtor<any>);
        return ctor;
    };
}
export function getFinders(): FinderSrc[] { return registry.payload(); }

/** Base class: exposes hydrated WebDriver element and children. */
export class SemanticObject {
    public readonly children: SemanticObject[] = [];
    public element?: WebDriverElement | null;
    constructor(public readonly session?: Session) { }

    childrenOfType<T extends SemanticObject>(ctor: new (...args: any[]) => T): T[] {
        return this.children.filter(c => c instanceof ctor) as T[];
    }

    // serialization reads from instance props

    private static pickSerializableProps(node: SemanticObject): Record<string, unknown> {
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

    toJSON(): any {
        const cls = (this as any).constructor.name;
        const clean = SemanticObject.pickSerializableProps(this);
        return [cls, clean, ...this.children.map(c => c.toJSON())];
    }

    toXML(indent: undefined | string = undefined): string {
        const pretty = indent != undefined;
        const esc = (s: string) =>
            s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

        const attrs = (props: Record<string, unknown>): string =>
            Object.entries(props || {})
                .filter(([k, v]) =>
                    k !== "element" && k !== "children" &&
                    v !== null && v !== undefined && (typeof v !== "object"))
                .map(([k, v]) => ` ${k}="${esc(String(v))}"`)
                .join("");

        const xmlOf = (node: SemanticObject, level: number): string => {
            const cls = (node as any).constructor.name;
            const rest = SemanticObject.pickSerializableProps(node);
            const a = attrs(rest);
            const kids = node.children ?? [];

            if (!pretty) {
                if (kids.length === 0) return `<${cls}${a}/>`;
                return `<${cls}${a}>${kids.map(c => (c as any).toXML(undefined)).join("")}</${cls}>`;
            }

            const pad = (indent as string).repeat(level);
            if (kids.length === 0) return `${pad}<${cls}${a}/>`;
            const open = `${pad}<${cls}${a}>`;
            const inner = kids.map(c => xmlOf(c, level + 1)).join("\n");
            const close = `${pad}</${cls}>`;
            return `${open}\n${inner}\n${close}`;
        };

        return xmlOf(this, 0);
    }
}

export class Root extends SemanticObject { }

export interface SemanticCtor<T extends SemanticObject> {
    new(session: Session): T;
    semanticClass: string;
    find(): Array<{ element: globalThis.Element;[k: string]: any }>;
}

type ElementOf<T> = T extends (infer U)[] ? U : never;

type HydrateElements<T> =
    T extends globalThis.Element ? WebDriverElement :
    T extends (infer U)[] ? HydrateElements<U>[] :
    T extends object ? { [K in keyof T]: HydrateElements<T[K]> } :
    T;

export type DTO<T extends object = {}> = { element: globalThis.Element } & T;

export type AnnotatedDTO<T> = HydrateElements<T> & {
    ["$semantic-class"]: string;
    children?: Array<AnnotatedDTO<any>>;
};

export type DTOOf<C extends { find: (...args: any[]) => any }> =
    AnnotatedDTO<ElementOf<ReturnType<C["find"]>>>;

/** ---------- Browser runner (stringified) ---------- */
function browserRunner(list: Array<{ name: string; src: string }>) {
    function findElementsByCss(selector: string, mapFn: (el: Element) => any) {
        const out: any[] = [];
        for (const el of document.querySelectorAll(selector)) {
            const r = mapFn(el);
            if (!r) continue;
            if (typeof r !== "object") continue;
            (r as any).element = el;
            out.push(r);
        }
        return out;
    }

    function compileFinder(src: string): Function {
        let e1: any, e2: any, e3: any;
        try { return (0, eval)(`(${src})`); } catch (err) { e1 = err; }
        try { return (0, eval)(`(function ${src})`); } catch (err) { e2 = err; }
        try { return (0, eval)(`({ ${src} }).find`); } catch (err) {
            e3 = err;
            throw new Error(
                `Failed to compile static find():\n- as expression: ${e1?.message || e1}\n- with 'function' prefix: ${e2?.message || e2}\n- as object method: ${e3?.message || e3}\nSource:\n${src}`
            );
        }
    }

    const flat: any[] = [];
    for (const { name, src } of list) {
        const f = compileFinder(src);
        let arr: any[] = [];
        try { arr = f() || []; } catch (err: any) {
            throw new Error(`Finder "${name}" threw: ${err?.message || err}\nSource:\n${src}`);
        }
        for (const dto of arr) flat.push({ ["$semantic-class"]: name, ...dto, children: [] });
    }

    const contains = (a: Element | null | undefined, b: Element | null | undefined) =>
        !!(a && b && a !== b && a.contains(b));

    for (let i = 0; i < flat.length; i++) {
        let bestParent: any | null = null;
        const child = flat[i];
        for (let j = 0; j < flat.length; j++) {
            if (i === j) continue;
            const maybe = flat[j];
            if (!contains(maybe.element, child.element)) continue;
            if (!bestParent) bestParent = maybe;
            else if (contains(bestParent.element, maybe.element)) bestParent = maybe;
        }
        if (bestParent) bestParent.children.push(child);
    }

    const childSet = new Set<any>();
    for (const n of flat) for (const c of n.children) childSet.add(c);
    return flat.filter(n => !childSet.has(n));
}

export function buildDiscoverScript(): string {
    let script = `// utility functions\n`;
    script += findElementsByCss.toString() + `\n`;

    const finders: { name: string, find: Function }[] = undefined;
    script += `\n// finder functions array\nconst finders = [\n`;
    for (let finder of getFinders()) {
        script += `{\n  name: ${JSON.stringify(finder.name)},\n  ${finder.src}\n},`;
    }
    script += `];\n`;

    script += `\n// algorithm to collect DTO objects\n` + function findElements() {
        let elements = [];
        for (let { name, find } of finders) {
            for (let item of find()) {
                item["$semantic-class"] = name;
                elements.push(item);
            }
        }
        return elements;
    }.toString() + `\n`;

    script += `\n` + function buildTree(elements) {
        const flat = elements.map(n => ({ ...n, children: [] }));
        for (let i = 0; i < flat.length; i++) {
            const child = flat[i];
            const childEl = child.element;
            let bestParent = null;
            for (let j = 0; j < flat.length; j++) {
                if (i === j) continue;
                const maybe = flat[j];
                const parentEl = maybe.element;
                if (!parentEl || !childEl || parentEl === childEl) continue;
                if (!parentEl.contains(childEl)) continue;
                if (!bestParent) bestParent = maybe;
                else if (bestParent.element && bestParent.element.contains(parentEl)) bestParent = maybe;
            }
            child.__parent = bestParent || null;
            if (bestParent) bestParent.children.push(child);
        }
        const roots = flat.filter(n => !n.__parent);
        for (const n of flat) delete n.__parent;
        return roots;
    }.toString() + `\n`;

    script += `\nreturn buildTree(findElements());`;
    return script;
}

/** Hydrate a DTO forest (from browser) into a Root tree. */
export function hydrate(session: Session, dtoRoots: Array<AnnotatedDTO<any>>): Root {
    const root = new Root(session);

    const RESERVED = new Set(["children", "element", "$semantic-class"]);
    function definePropsFromDto(inst: SemanticObject, dto: Record<string, unknown>) {
        for (const [k, v] of Object.entries(dto)) {
            if (RESERVED.has(k)) continue;
            if (typeof v === "function") continue;
            if (Object.prototype.hasOwnProperty.call(inst, k)) continue;
            Object.defineProperty(inst, k, {
                value: v,
                writable: false,
                enumerable: true,
                configurable: true,
            });
        }
    }

    function makeNode(dto: AnnotatedDTO<any>): SemanticObject {
        const ctor = registry.ctorOf(dto["$semantic-class"]);
        const inst = ctor ? new ctor(session) : new SemanticObject(session);

        (inst as any).element = (dto as any).element ?? null;   // attach WD element
        definePropsFromDto(inst, dto as any);                   // copy DTO props

        const kids = dto.children || [];
        for (const child of kids) inst.children.push(makeNode(child));
        return inst;
    }

    for (const dto of dtoRoots || []) root.children.push(makeNode(dto));
    return root;
}

/** Discover: build → execute → hydrate (no debug logging). */
export async function discover(session: Session): Promise<Root> {
    return hydrate(session, await session.executeScript(buildDiscoverScript()));
}

/** Browser-side helper, re-exported for user finders. */
export function findElementsByCss<T extends object = {}>(
    selector: string,
    mapFn: (el: globalThis.Element) => T | undefined
): Array<{ element: globalThis.Element } & Omit<T, "element">> {
    const out: any[] = [];
    for (const el of document.querySelectorAll(selector)) {
        const r = mapFn(el);
        if (!r) continue;
        if (typeof r !== "object") continue;
        (r as any).element = el;
        out.push(r);
    }
    return out;
}

// what to ignore when mapping instance → DTO
type RuntimeKeys = "children" | "element" | "session";

/* primitive-ish */
type Primitiveish = string | number | boolean | null | undefined;

/* map WebDriverElement → Element (and recurse through arrays/objects) */
type ToFinderValue<T> =
    // direct WD element (nullable/optional also supported)
    T extends WebDriverElement | null | undefined ? (Element | null) :
    // arrays (readonly or mutable)
    T extends readonly (infer U)[] ? ReadonlyArray<ToFinderValue<U>> :
    T extends (infer U)[] ? ToFinderValue<U>[] :
    // objects: map each field
    T extends object ? { [K in keyof T]: ToFinderValue<T[K]> } :
    // primitives pass through
    T extends Primitiveish ? T :
    // everything else is not representable in a finder DTO
    never;

/* pick only DTO-like keys from an instance type */
type AllowedDTOKeysOf<T> = {
    [K in keyof T]-?:
    // strip runtime-only
    K extends RuntimeKeys ? never :
    // drop methods
    T[K] extends (...args: any[]) => any ? never :
    // keep only things that can become ToFinderValue (not never)
    [ToFinderValue<T[K]>] extends [never] ? never : K
}[keyof T];

/**
 * The DTO shape produced by `find()` for a given class constructor.
 * - Always includes `element: Element`
 * - Includes only allowed instance props
 * - Converts WebDriverElement → Element (recursively)
 */
export type Find<Ctor extends new (...args: any[]) => SemanticObject> =
    { element: Element } &
    { [K in AllowedDTOKeysOf<InstanceType<Ctor>>]: ToFinderValue<InstanceType<Ctor>[K]> };

/** Convenience: fields-only part (without the required `element`), suitable for use in findElementsByCss */
export type FindByCSSFields<Ctor extends new (...args: any[]) => SemanticObject> =
    Omit<Find<Ctor>, "element">;
