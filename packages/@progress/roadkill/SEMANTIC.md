# Semantic Objects

**Semantic Objects** extend Page Objects with *discovery* and *snapshots*:

* Discovered in the **browser** via a pure `static find()` (one round-trip).
* Hydrated into classes with **readonly properties** (captured by `find()`).
* Arranged in a **tree** by **DOM containment** using each object's anchor **element**.
* Used with **methods for interactions** (click/type) and **properties for assertions**.

The workflow is: **discover - hydrate - assert - (optionally) interact**.

---

## Resource Management

Semantic Objects work with both resource management patterns:

### Per-Test Automatic Cleanup (Recommended)
```typescript
import { describe, it } from "vitest";
import { WebDriverClient } from "@progress/roadkill";

describe("semantic tests", () => {
  it("uses automatic cleanup", async () => {
    await using client = new WebDriverClient("http://localhost:4444");
    await using session = await client.session({ browserName: "chrome" });
    
    const objects = await session.find([LoginForm, UserCard]);
    // Automatic disposal when test completes
  });
});
```

### Suite-Level Manual Cleanup (When Needed)
```typescript
describe("semantic suite", () => {
  let session: Session;
  
  beforeAll(async () => {
    const client = new WebDriverClient("http://localhost:4444");
    session = await client.session({ browserName: "chrome" });
  });
  
  afterAll(async () => {
    await session?.[Symbol.asyncDispose](); // ECMAScript 2024 disposal
  });
  
  it("reuses session", async () => {
    const objects = await session.find([LoginForm]);
    // Session cleanup handled in afterAll
  });
});
```

---

## Why not just Page Objects?

Classic Page Objects are predefined and often read from the DOM during tests, causing chatty round-trips and drift.
Semantic Objects are **discovered at runtime**, capturing values up front so assertions are **synchronous** and **stable**.

---

## Design

* Every semantic class:

  * uses `@semantic()` and implements a **pure** `static find()` (no imports/closures).
  * returns **DTOs**: `{ element, ...props }[]` (site-specific selectors).
  * has a single constructor `(driver, dto)` that hydrates **readonly fields** from the DTO.
  * exposes **methods** only for interactions (async).

* The runner sends all `find()` functions in a single `executeScript`, builds the **tree in the browser** using `element.contains(...)`, and returns only root DTOs.

* Node hydrates DTOs to instances and you get:

  * `JSON.stringify(root, null, "  ")` - compact tuple snapshots: `["Class", {props}, ...children]`
  * `root.toXML()` - pretty XML snapshots (future XPath-ready)

---

## Quick start

```ts
// discovery
const root = await discover(driver);

// assert via hydrated properties (no extra reads)
const items = root.children.filter(x => x instanceof ShoppingItem) as ShoppingItem[];
expect(items[0].name).toBe("USB-C Charger");

// interact only when needed
await items[0].addToCart();

// snapshots
console.log(JSON.stringify(root, null, "  "));
console.log(root.toXML());
```

See `example.ts` for `ShoppingPage`, `Navigation`, `NavigationLink`, `ShoppingItem`.

---

## Authoring a semantic object

```ts
@semantic()
export class ShoppingItem extends SemanticObject {
  public readonly name: string;
  public readonly priceText: string;
  private readonly addButton: WebElement;

  static find(): DTO<{ name: string; priceText: string; addButton: Element }>[] {
    return findElementsByCss(".item-card", card => ({
      element: card,
      name: (card.querySelector(".item-title")!.textContent || "").trim(),
      priceText: (card.querySelector(".item-price")!.textContent || "").trim(),
      addButton: card.querySelector(".add-to-cart")!
    }));
  }

  constructor(driver: WebDriver, dto: DTOOf<typeof ShoppingItem>) {
    super(driver, dto);
    this.name = dto.name;
    this.priceText = dto.priceText;
    this.addButton = dto.addButton;
  }

  async addToCart() { await this.addButton.click(); }
}
```

### Recommendations

* **Read in `find()`**: capture all values you’ll assert (strings/numbers/booleans).
* **Be strict**: if a field/button is required, ensure it in `find()` (skip/throw).
* **Single-site selectors**: prefer one clear selector per property; avoid multi-site heuristics.
* **One element per object**: the `element` is the anchor; other handles (e.g., `addButton`) can be captured as fields.
* **Methods for actions only**: keep assertions on readonly properties; actions are the only async part.

---

## Built-in helper (usable inside `find()`)

### `findElementsByCss(selector, mapFn)`

Injected into the browser so that any `find()` can use it directly.

* **selector**: CSS selector string
* **mapFn**: `(element: Element) => { element, …props }`
* **returns**: DTO array

Example:

```ts
static find(): DTO<{ text: string }>[] {
  return findElementsByCss("nav.site-nav a", el => ({
    element: el,
    text: (el.textContent || "").trim()
  }));
}
```

---

## Snapshots

* **JSON tuples** (machine-friendly, easy diffs):

  ```json
  [
    "ShoppingItem",
    { "name": "Item A", "priceText": "$19.99" }
  ]
  ```
* **XML** (human-friendly, compact):

  ```xml
  <ShoppingItem name="Item A" priceText="$19.99"/>
  ```

Use either/both in golden snapshot tests. XML also sets you up for XPath later if you choose to mirror to a DOM and map back to semantic instances.

---

## API (short)

```ts
export function semantic(): ClassDecorator;
export async function discover(driver: WebDriver): Promise<Root>;

export class SemanticObject {
  readonly element: WebElement | null;
  readonly children: SemanticObject[];
  childrenOfType<T extends SemanticObject>(ctor: new (...args:any[]) => T): T[];
  toJSON(): any; // ["Class",{props},...children]
  toXML(): string; // <Class ...props>...</Class>
}

export class Root extends SemanticObject {}

export type DTO<T extends object = {}> = { element: Element } & T;
export type DTOOf<C extends { find: (...args: any[]) => any }> = AnnotatedDTO<ElementOf<ReturnType<C["find"]>>>;
```

---

## Notes

* `find()` must be **pure** (serializable) because it’s injected via `.toString()` and executed in the browser sandbox.
* The tree is built **in the browser** to avoid many `executeScript` calls on Node.
* If your app state changes (modal opens, list expands), call `discover(driver)` again to hydrate a fresh tree.

---

Happy testing!
