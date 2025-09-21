// semantic.ts
import type { WebDriver, WebElement } from "selenium-webdriver";

// Registry, decorator, helper

type FinderSrc = { name: string; src: string };

/**
 * Keeps track of semantic classes and their registered static `find` functions.
 * Stores the browser-side function sources and the constructors for hydration.
 */
class Registry {
    private readonly list: FinderSrc[] = [];
    private readonly ctors = new Map<string, SemanticCtor<any>>();

    /** Register a semantic class with its static `find()` function. */
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

/** Class decorator that marks a class as semantic and registers it. */
export function semantic() {
    return function <T extends new (...args: any[]) => any>(ctor: T) {
        registry.register(ctor as unknown as SemanticCtor<any>);
        return ctor;
    };
}

/** Get the list of registered finders (for custom runners or debugging). */
export function getFinders(): FinderSrc[] {
    return registry.payload();
}

// Semantic object hierarchy

/**
 * Base class for all semantic objects. Wraps its DTO (for data access),
 * exposes the decomposed `element` (WebElement), and provides a tree of children.
 */
export class SemanticObject {
    readonly children: SemanticObject[] = [];
    readonly element: WebElement | null;

    constructor(
        protected readonly driver: WebDriver,
        protected readonly dto: AnnotatedDTO<any>
    ) {
        this.element = (dto && "element" in dto ? (dto as any).element : null) ?? null;
    }

    /** Return the direct children that are instances of the given semantic class. */
    childrenOfType<T extends SemanticObject>(ctor: new (...args: any[]) => T): T[] {
        return this.children.filter(c => c instanceof ctor) as T[];
    }

    /** JSON tuple: [ "ClassName", { props }, ...children ] (stable snapshots). */
    toJSON(): any {
        const cls = (this as any).constructor.name;
        const { element, children, ...props } = (this as any).dto || {};
        return [cls, props, ...this.children.map(c => c.toJSON())];
    }

    /** XML snapshot: <Class ...props>...children...</Class> (human-friendly). */
    toXML(): string {
        function esc(s: string) {
            return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
                    .replace(/"/g,"&quot;").replace(/'/g,"&apos;");
        }
        function attrs(props: Record<string, unknown>): string {
            return Object.entries(props || {})
                .filter(([_, v]) => v !== null && v !== undefined && (typeof v !== "object"))
                .map(([k, v]) => ` ${k}="${esc(String(v))}"`)
                .join("");
        }
        const cls = (this as any).constructor.name;
        const { element, children, ...rest } = (this as any).dto || {};
        const a = attrs(rest);
        if (this.children.length === 0) return `<${cls}${a}/>`;
        return `<${cls}${a}>${this.children.map(c => c.toXML()).join("")}</${cls}>`;
    }
}

/** Root of the semantic tree (no element). Always returned by `discover()`. */
export class Root extends SemanticObject {
    constructor(driver: WebDriver) {
        super(driver, { "$semantic-class": "Root" } as AnnotatedDTO<{}>);
    }
}

// Class contract for constructors

/**
 * Contract implemented by semantic object classes.
 * Each class must:
 *  - have a constructor `(driver, dto)`
 *  - define a pure static `find()` that runs in the page and returns DTOs with `element`
 */
export interface SemanticCtor<T extends SemanticObject> {
    new (driver: WebDriver, dto: AnnotatedDTO<any>): T;
    semanticClass: string;
    find(): Array<{ element: any; [k: string]: any }>;
}

// Type helpers

type ElementOf<T> = T extends (infer U)[] ? U : never;

/** Browser-side DTO returned by `find()`; stamped later with "$semantic-class". */
export type DTO<T extends object = {}> = { element: Element } & T;

/** A stamped DTO (Node side) with optional nested children. */
export type AnnotatedDTO<T> = T & {
    ["$semantic-class"]: string;
    element?: WebElement;
    children?: Array<AnnotatedDTO<any>>;
};

/** Infer the stamped DTO type from a class' static `find()` result. */
export type DTOOf<C extends { find: (...args: any[]) => any }> =
    AnnotatedDTO<ElementOf<ReturnType<C["find"]>>>;

// Discovery runner

/**
 * Run all registered `find()` functions inside the page, stamp them with
 * "$semantic-class", build a tree by element containment (in-browser), and
 * hydrate to instances. Returns Root.
 */
export async function discover(driver: WebDriver): Promise<Root> {
    const finders = getFinders();

    const runner = function(list: Array<{ name: string; src: string }>) {
        // Helper available inside any find(): map CSS selector → DTOs
        function findElementsByCss(selector: string, mapFn: (el: Element) => any) {
            return Array.from(document.querySelectorAll(selector)).map(el => mapFn(el));
        }

        // Execute finders and stamp classes
        const flat: any[] = [];
        for (const { name, src } of list) {
            // eslint-disable-next-line no-eval
            const f = (0, eval)(`(${src})`);
            const arr = f() || [];
            for (const dto of arr) flat.push({ ["$semantic-class"]: name, ...dto, children: [] });
        }

        // Build containment-based tree
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
                else if (contains(bestParent.element, maybe.element)) bestParent = maybe; // tighter
            }
            if (bestParent) bestParent.children.push(child);
        }

        // Roots = those not referenced as a child
        const childSet = new Set<any>();
        for (const n of flat) for (const c of n.children) childSet.add(c);
        return flat.filter(n => !childSet.has(n));
    };

    const script = `return (${runner.toString()})(${JSON.stringify(finders)});`;
    const rootDtos: Array<AnnotatedDTO<any>> = await driver.executeScript(script);

    // Hydration
    const root = new Root(driver);
    function hydrate(dto: AnnotatedDTO<any>): SemanticObject {
        const ctor = registry.ctorOf(dto["$semantic-class"]);
        const inst = ctor ? new ctor(driver, dto) : new SemanticObject(driver, dto);
        if (dto.children && dto.children.length) {
            for (const c of dto.children) inst.children.push(hydrate(c));
        }
        return inst;
    }
    for (const dto of rootDtos) root.children.push(hydrate(dto));
    return root;
}
