// semantic.ts
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
    readonly children: SemanticObject[] = [];
    readonly element: WebDriverElement | null;
    constructor(
        protected readonly session: Session,
        protected readonly dto: AnnotatedDTO<any>
    ) {
        this.element = (dto && "element" in dto ? (dto as any).element : null) ?? null;
    }
    childrenOfType<T extends SemanticObject>(ctor: new (...args: any[]) => T): T[] {
        return this.children.filter(c => c instanceof ctor) as T[];
    }
    toJSON(): any {
        const cls = (this as any).constructor.name;
        const { element, children, ["$semantic-class"]: _skip, ...props } = (this as any).dto || {};
        // keep only primitive/array-of-primitives (like your prune logic)
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(props)) {
            if (v == null) { clean[k] = v; continue; }
            const t = typeof v;
            if (t === "string" || t === "number" || t === "boolean") { clean[k] = v; continue; }
            if (Array.isArray(v) && v.every(x => x == null || ["string", "number", "boolean"].includes(typeof x))) {
                clean[k] = v; continue;
            }
        }
        return [cls, clean, ...this.children.map(c => c.toJSON())];
    }
    toXML(indent: undefined | string = undefined): string {
        const pretty: boolean = indent != undefined;

        function esc(s: string) {
            return s
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&apos;");
        }

        // exclude `$semantic-class`, and any non-primitive/object-ish values
        function attrs(props: Record<string, unknown>): string {
            return Object.entries(props || {})
                .filter(([k, v]) =>
                    k !== "$semantic-class" &&                     // 🔒 don't print
                    k !== "element" &&                             // element is object-y
                    k !== "children" &&                            // children is object-y
                    v !== null && v !== undefined &&
                    (typeof v !== "object")
                )
                .map(([k, v]) => ` ${k}="${esc(String(v))}"`)
                .join("");
        }

        if (!pretty) {
            const cls = (this as any).constructor.name;
            const { element, children, ...rest } = (this as any).dto || {};
            const a = attrs(rest);
            if (this.children.length === 0) return `<${cls}${a}/>`;
            return `<${cls}${a}>${this.children.map(c => (c as any).toXML(undefined)).join("")}</${cls}>`;
        }

        // Pretty-printed recursive formatter
        const xmlOf = (node: SemanticObject, level: number): string => {
            const cls = (node as any).constructor.name;
            const { element, children, ...rest } = (node as any).dto || {};
            const a = attrs(rest);
            const pad = (indent as string).repeat(level);
            const kids = node.children || [];
            if (kids.length === 0) return `${pad}<${cls}${a}/>`;
            const open = `${pad}<${cls}${a}>`;
            const inner = kids.map(c => xmlOf(c, level + 1)).join("\n");
            const close = `${pad}</${cls}>`;
            return `${open}\n${inner}\n${close}`;
        };

        return xmlOf(this, 0);
    }
}

function pruneJsonProps(props: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
        if (v == null) { out[k] = v; continue; }
        const t = typeof v;
        if (t === "string" || t === "number" || t === "boolean") { out[k] = v; continue; }
        if (Array.isArray(v) && v.every(x => x == null || ["string", "number", "boolean"].includes(typeof x))) {
            out[k] = v; continue;
        }
    }
    return out;
}

export class Root extends SemanticObject {
    constructor(session: Session) {
        super(session, { "$semantic-class": "Root" } as AnnotatedDTO<{}>);
    }
}

export interface SemanticCtor<T extends SemanticObject> {
    new(session: Session, dto: AnnotatedDTO<any>): T;
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

/** ---------- Browser runner (extracted so we can build/log scripts) ---------- */
function browserRunner(list: Array<{ name: string; src: string }>) {
    // Browser helper (unchanged)
    function findElementsByCss(selector: string, mapFn: (el: Element) => any) {
        const out: any[] = [];
        for (const el of document.querySelectorAll(selector)) {
            const r = mapFn(el);
            if (!r) continue;
            if (typeof r !== "object") continue;
            (r as any).element = el; // always assign/overwrite anchor
            out.push(r);
        }
        return out;
    }

    // 🔧 NEW: compile method-string safely
    function compileFinder(src: string): Function {
        let e1: any, e2: any, e3: any;
        try {
            // function foo(){}  OR  (args)=>{}  OR  async (args)=>{}
            return (0, eval)(`(${src})`);
        } catch (err) { e1 = err; }
        try {
            // turns "find(){}" into "function find(){}"
            return (0, eval)(`(function ${src})`);
        } catch (err) { e2 = err; }
        try {
            // turns "find(){}" into object method: ({ find(){} }).find
            return (0, eval)(`({ ${src} }).find`);
        } catch (err) {
            e3 = err;
            throw new Error(
                `Failed to compile static find():\n- as expression: ${e1?.message || e1}\n- with 'function' prefix: ${e2?.message || e2}\n- as object method: ${e3?.message || e3}\nSource:\n${src}`
            );
        }
    }

    const flat: any[] = [];
    for (const { name, src } of list) {
        const f = compileFinder(src);
        let arr: any[];
        try {
            arr = f() || [];
        } catch (err: any) {
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

/** Build the exact script sent to the browser (for debugging/logging). */
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
        // Clone and ensure every node has a children array
        const flat = elements.map(n => ({ ...n, children: [] }));

        // For each node, find the tightest ancestor by DOM containment
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

                // Choose the tightest parent (closest ancestor)
                if (!bestParent) bestParent = maybe;
                else if (bestParent.element && bestParent.element.contains(parentEl)) {
                    bestParent = maybe;
                }
            }

            // Link child to best parent (if any)
            child.__parent = bestParent || null;
            if (bestParent) bestParent.children.push(child);
        }

        // Roots are those without a parent
        const roots = flat.filter(n => !n.__parent);

        // Clean up temp fields
        for (const n of flat) delete n.__parent;

        return roots;
    }.toString() + `\n`;

    script += `\nreturn buildTree(findElements());`;

    return script;
}

/** Hydrate a DTO forest (as returned by the browser script) into a Root tree. */
export function hydrate(session: Session, dtoRoots: Array<AnnotatedDTO<any>>): Root {
    const root = new Root(session);

    function makeNode(dto: AnnotatedDTO<any>): SemanticObject {
        const ctor = registry.ctorOf(dto["$semantic-class"]);
        const inst = ctor ? new ctor(session, dto) : new SemanticObject(session, dto);
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

export function findElementsByCss<
    T extends object = {}
>(
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
