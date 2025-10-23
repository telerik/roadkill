/**
 * ECMAScript Explicit Resource Management (ES2024)
 * Requires Node.js 22+ for Symbol.dispose support
 */

// Type declaration for AbortSignal.any (Node.js 22+)
declare global {
    interface AbortSignalConstructor {
        any(signals: AbortSignal[]): AbortSignal;
    }
}

/**
 * [6.6 Errors](https://www.w3.org/TR/webdriver2/#errors)
 */
export interface ErrorResult {
    value: {
        error: string;
        message: string;
        stacktrace: string;
        data?: unknown;
    }
}

export class WebDriverMethodError extends Error {
    constructor(error?: string, options?: ErrorOptions, args?: {}) {
        super(error, options);
        if (args)
            for (const key in args)
                this[key] = args[key];
    }
}

export class WebDriverRequestError extends Error {

    constructor(error: string | ErrorResult, options?: ErrorOptions) {
        super(typeof error == "string" ? error : `${error.value.error}: ${error.value.message}`, options);
        if (typeof error == "object" && error?.value) {
            if (error.value.stacktrace)
                Object.defineProperty(this, "stacktrace", { value: error.value.stacktrace, enumerable: false });
            if (error.value.data)
                this["data"] = error.value.data;
        }
    }
}

/**
 * [7.1 Proxy](https://www.w3.org/TR/webdriver2/#proxy)
 */
export type Proxy = {
    /**
     * Indicates the type of proxy configuration.
     */
    proxyType: "pac",
    /**
     * Defines the URL for a proxy auto-config file if proxyType is equal to "pac".
     * Any URL.
     */
    proxyAutoconfigUrl: string
} | {
    /**
     * Indicates the type of proxy configuration.
     */
    proxyType: "direct" | "autodetect" | "system",
} | {
    /**
     * Indicates the type of proxy configuration.
     */
    proxyType: "manual",
    /**
     * Defines the proxy host for FTP traffic when the proxyType is "manual".
     * A host and optional port for scheme "ftp".
     */
    ftpProxy?: string,
    /**
     * Defines the proxy host for HTTP traffic when the proxyType is "manual".
     * A host and optional port for scheme "http".
     */
    httpProxy?: string,
    /**
     * Lists the address for which the proxy should be bypassed when the proxyType is "manual".
     * A List containing any number of Strings.
     */
    noProxy?: string[],
    /**
     * Defines the proxy host for encrypted TLS traffic when the proxyType is "manual".
     * A host and optional port for scheme "https".
     */
    sslProxy?: string,

    /**
     * Defines the proxy host for a SOCKS proxy when the proxyType is "manual".
     * A host and optional port with an undefined scheme.
     */
    socksProxy?: string,

    /**
     * Defines the SOCKS proxy version when the proxyType is "manual".
     * Any integer between 0 and 255 inclusive.
     */
    socksVersion?: number
};

/**
 * [7.2 Processing capabilities](https://www.w3.org/TR/webdriver2/#processing-capabilities)
 */
export interface ProcessCapabilities {
    capabilities: {
        alwaysMatch: ValidateCapabilities,
        firstMatch: ValidateCapabilities[]
    }
}

/**
 * [7.2 Processing capabilities](https://www.w3.org/TR/webdriver2/#processing-capabilities)
 */
export interface ValidateCapabilities {
    acceptInsecureCerts?: boolean,
    browserName?: string,
    browserVersion?: string,
    platformName?: string,
    pageLoadStrategy?: PageLoadStrategy,
    proxy?: Proxy,
    strictFileInteractability?: boolean,
    timeouts?: TimeoutsConfiguration,
    unhandledPromptBehavior?: UnhandledPromptBehavior,
    /**
     * An additional WebDriver capability
     * or
     * The key of an extension capability
     */
    [key: `${string}:${string}`]: unknown
};

/**
 * [7.2 Processing capabilities](https://www.w3.org/TR/webdriver2/#processing-capabilities)
 */
export interface MatchingCapabilities {
    /**
     * ASCII Lowercase name of the user agent as a string.
     */
    browserName: string,
    /**
     * The user agent version, as a string.
     */
    browserVersion: string,
    /**
     * ASCII Lowercase name of the current platform as a string.
     */
    platformName: string,
    /**
     * Boolean initially set to false, indicating the session will not implicitly trust untrusted or self-signed TLS certificates on navigation.
     */
    acceptInsecureCerts: boolean,
    /**
     * Boolean initially set to false, indicating that interactability checks will be applied to <input type=file>.
     */
    strictFileInteractability: boolean,
    /**
     * Boolean indicating whether the remote end supports all of the resizing and positioning commands.
     */
    setWindowRect: boolean,
    proxy?: Proxy,
    /**
     * Optionally add extension capabilities as entries to matched capabilities.
     */
    [key: string]: unknown,
}

/**
 * [9. Timeouts](https://www.w3.org/TR/webdriver2/#timeouts)
 */
export type TimeoutsConfiguration = {
    /**
     * Specifies when to interrupt a script that is being evaluated.
     * A null value implies that scripts should never be interrupted, but instead run indefinitely.
     * default: 30000
     */
    script?: null | number;

    /**
     * Provides the timeout limit used to interrupt an explicit navigation attempt.
     */
    pageLoad?: number;

    /**
     * Specifies a time to wait for the element location strategy to complete when locating an element.
     */
    implicit?: number;
}

/**
 * [10. Navigation](https://www.w3.org/TR/webdriver2/#navigation)
 */
export enum PageLoadStrategy {
    none = "none",
    eager = "eager",
    normal = "normal"
}

/**
 * [11. Contexts](https://www.w3.org/TR/webdriver2/#contexts)
 * 
 * The use of the term “window” to refer to a top-level browsing context is legacy and doesn’t correspond with either the operating system notion of a “window” or the DOM Window object.
 */
export type WindowHandle = string;

/**
 * [11.8 Resizing and positioning window](https://www.w3.org/TR/webdriver2/#resizing-and-positioning-windows)
 */
export interface WindowRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * [12. Elements](https://www.w3.org/TR/webdriver2/#elements)
 */
export type ElementId = string;

/**
 * [12. Elements](https://www.w3.org/TR/webdriver2/#elements)
 */
const webElementIdentifier = "element-6066-11e4-a52e-4f735466cecf";
export interface WebElementReference {
    readonly [webElementIdentifier]: ElementId;
}

/**
 * [12.2 Shadow Roots](https://www.w3.org/TR/webdriver2/#shadow-root)
 */
export type ShadowRootId = string;

/**
 * [12.2 Shadow Roots](https://www.w3.org/TR/webdriver2/#shadow-root)
 */
const shadowRootIdentifier = "shadow-6066-11e4-a52e-4f735466cecf";
interface ShadowRootReference {
    readonly [shadowRootIdentifier]: ShadowRootId;
}

/**
 * [12.3.1 Locator strategies](https://www.w3.org/TR/webdriver2/#locator-strategies)
 */
export enum LocatorStrategy {
    cssSelector = "css selector",
    linkTextSelector = "link text",
    partialLinkText = "partial link text",
    tagName = "tag name",
    xPathSelector = "xpath"
}

/**
 * [12.3.1.1 CSS selectors](https://www.w3.org/TR/webdriver2/#css-selectors)
 */
export interface CSSSelector {
    using: "css selector",
    /**
     * The search CSS selector.
     */
    value: string
}

/**
 * [12.3.1.2 Link text](https://www.w3.org/TR/webdriver2/#link-text)
 */
export interface LinkText {
    using: "link text",
    /**
     * The link text to look for.
     */
    value: string
}

/**
 * [12.3.1.3 Partial link text](https://www.w3.org/TR/webdriver2/#partial-link-text)
 */
export interface PartialLinkText {
    using: "partial link text",
    /**
     * The partial link text to look for.
     */
    value: string
}

/**
 * [12.3.1.4 Tag name](https://www.w3.org/TR/webdriver2/#tag-name)
 */
export interface TagName {
    using: "tag name",
    /**
     * The tag name of the the element to look for.
     */
    value: string
}

/**
 * [12.3.1.5 XPath](https://www.w3.org/TR/webdriver2/#xpath)
 */
export interface XPathSelector {
    using: "xpath",
    /**
     * The XPath query to search with.
     */
    value: string
}

/**
 * [14. Cookies](https://www.w3.org/TR/webdriver2/#cookies)
 */
export interface Cookie {
    name: string;
    value: string;
    path?: string;
    domain?: string;
    secure?: boolean;
    httpOnly?: boolean;
    expiry?: number;
    sameSite?: "Lax" | "Strict" | "None";
}

export type ElementLookup = CSSSelector | LinkText | PartialLinkText | TagName | XPathSelector;

export namespace by {
    export const css = (cssSelector: string): CSSSelector => ({ using: "css selector", value: cssSelector });
    export const link = (linkText: string): LinkText => ({ using: "link text", value: linkText });
    export const partialLink = (partialLinkText: string): PartialLinkText => ({ using: "partial link text", value: partialLinkText });
    export const tagName = (tag: string): TagName => ({ using: "tag name", value: tag });
    export const xPath = (xPath: string): XPathSelector => ({ using: "xpath", value: xPath });
}

export type SingleUnicodeCodePoint = string;

export namespace Actions {
    export interface Pause {
        type: "pause";
        duration: number;
    }

    export interface KeyUp {
        type: "keyUp";
        /**
         * Key. A String containing a single unicode code point.
         */
        value: string;
    }

    export interface KeyDown {
        type: "keyDown";
        /**
         * Key. A String containing a single unicode code point.
         */
        value: string;
    }

    export interface PointerState {
        width?: number;
        height?: number;
        pressure?: number;
        tangentialPressure?: number;
        tiltX?: number;
        tiltY?: number;
        twist?: number;
        altitudeAngle?: number;
        azimuthAngle?: number;
    }

    export interface PointerUp extends PointerState {
        type: "pointerUp";
        button: number;
    }

    export interface PointerDown extends PointerState {
        type: "pointerDown";
        button: number;
    }

    export interface PointerMove extends PointerState {
        type: "pointerMove";
        duration: number;
        /**
         * A `"viewport"` or `"pointer"` constants, or an {@link Element}.
         */
        origin?: "viewport" | "pointer" | WebElementReference;

        x: number;
        y: number;
    }

    export interface PointerCancel {
        type: "pointerCancel";
    }

    export interface Scroll {
        type: "scroll";
        duration?: number;
        /**
         * A `"viewport"` or `"pointer"` constants, or an {@link Element}.
         */
        origin?: "viewport" | "pointer" | WebElementReference;

        x: number;
        y: number;
        deltaX: number;
        deltaY: number;
    }
}

export interface ActionSequenceNone {
    type: "none";
    id: string;
    actions: (Actions.Pause)[];
}

export interface ActionSequenceKey {
    type: "key";
    id: string;
    actions: (Actions.KeyUp | Actions.Pause | Actions.KeyDown)[];
}

export interface ActionSequencePointer {
    type: "pointer";
    id: string;
    parameters?: {
        pointerType?: "mouse" | "pen" | "touch";
    };
    actions: (Actions.Pause | Actions.PointerUp | Actions.PointerDown | Actions.PointerMove | Actions.PointerCancel)[];
}

export interface ActionSequenceWheel {
    type: "wheel";
    id: string;
    actions: (Actions.Pause | Actions.Scroll)[];
}

/**
 * [15.5 Processing actions](https://www.w3.org/TR/webdriver2/#processing-actions)
 */
export type ActionSequence = ActionSequenceNone | ActionSequenceWheel | ActionSequencePointer | ActionSequenceKey;

/**
 * [16. User Prompts](https://www.w3.org/TR/webdriver2/#user-prompts)
 */
export enum UnhandledPromptBehavior {
    /**
     * All simple dialogs encountered should be dismissed.
     */
    "dismiss" = "dismiss",
    /**
     * All simple dialogs encountered should be accepted.
     */
    "accept" = "accept",
    /**
     * All simple dialogs encountered should be dismissed, and an error returned that the dialog was handled.
     */
    "dismiss and notify" = "dismiss and notify",
    /**
     * All simple dialogs encountered should be accepted, and an error returned that the dialog was handled.
     */
    "accept and notify" = "accept and notify",
    /**
     * All simple dialogs encountered should be left to the user to handle.
     */
    "ignore" = "ignore"
}

export type Method = "GET" | "POST" | "DELETE";

export interface Serializer {
    serialize?(value: unknown): unknown;
    deserialize?(value: unknown): unknown;
}

export interface WebDriverClientOptions {
    address: string;
    enableLogging?: boolean;
    logPrefix?: string;
    log?: (line: string) => void;
}

/**
 * A [Local end](https://www.w3.org/TR/webdriver2/#nodes) node implementation of the WebDriver specification.
 */

// Helpers for safe JSON (de)serialization
function withReplacer(serializer?: Serializer) {
    return typeof serializer?.serialize === "function"
        ? (_k: string, v: unknown) => serializer!.serialize!(v)
        : undefined;
}
function withReviver(serializer?: Serializer) {
    return typeof serializer?.deserialize === "function"
        ? (_k: string, v: unknown) => serializer!.deserialize!(v)
        : undefined;
}

export class WebDriverClient {

    public constructor(public readonly options: WebDriverClientOptions, public readonly fetchImplementation: typeof fetch = fetch) {
    }

    get prefix() { return this.options.logPrefix ?? "[WebDriverClient]"; }

    protected log(line: string) {
        if (this.options?.enableLogging) (this.options.log ?? console.log)(`${this.prefix ? this.prefix + " " : ""}${line}`);
    }

    /**
     * Protected virtual method for signal handling that can be overridden in context-aware instances.
     * @param signal The signal to process
     * @returns The processed signal or undefined
     */
    protected withSignal(signal?: AbortSignal): AbortSignal | undefined {
        return signal;
    }

    /**
     * Creates a context-aware WebDriverClient that combines signals from the context with method calls.
     * @param context The context containing a signal to be combined with method calls
     * @returns A new WebDriverClient instance that automatically combines signals
     */
    public context<T extends WebDriverClient>(this: T, context: { signal?: AbortSignal }): T {
        const originalClient = this;
        
        // Create a new object with the same prototype chain
        const contextClient = Object.create(Object.getPrototypeOf(this));
        
        // Override the withSignal method to combine signals
        contextClient.withSignal = function(signal?: AbortSignal): AbortSignal | undefined {
            const baseSignal = originalClient.withSignal.call(this, signal);
            
            if (baseSignal && context.signal) {
                // Combine both signals using AbortSignal.any (Node.js 22+)
                return AbortSignal.any([baseSignal, context.signal]);
            }
            
            return context.signal ?? baseSignal;
        };
        
        return contextClient as T;
    }

    /**
     * 8.1 New Session
     * https://www.w3.org/TR/webdriver2/#new-session
     */
    public async newSession(options: ProcessCapabilities | { capabilities: ValidateCapabilities }, signal?: AbortSignal): Promise<Session> {
        try {
            const result = await this.request<
                ProcessCapabilities | { capabilities: ValidateCapabilities },
                { capabilities: MatchingCapabilities, sessionId: string }
            >("POST", "/session", options, signal);
            return new Session(this, result.sessionId, result.capabilities);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to create a new session.`, { cause }, { options });
        }
    }

    /**
     * 8.3 Status
     * https://www.w3.org/TR/webdriver2/#status
     */
    public async status(signal?: AbortSignal): Promise<{ ready: boolean, message: string, [other: string]: unknown }> {
        try {
            return await this.request<{}, { ready: boolean, message: string }>("GET", "/status", undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError("Failed to retrieve status.", { cause });
        }
    }

    public async request<Args, Result>(method: Method, uri: string, args?: Args, signal?: AbortSignal, serializer?: Serializer): Promise<Result> {
        try {
            const headers: Record<string, string> = { "Accept": "application/json" };
            const requestInit: RequestInit = { method, headers };
            signal = this.withSignal(signal);
            if (signal) requestInit.signal = signal;
            if (args !== undefined) {
                headers["Content-Type"] = "application/json; charset=utf-8";
                requestInit.body = JSON.stringify(args, withReplacer(serializer));
            }

            const bodyStr = typeof requestInit.body === "string" ? requestInit.body.slice(0, 40) : "";
            this.log(`fetch: ${method} ${uri}${bodyStr ? " " + bodyStr : ""}`);
            const response = await this.fetchImplementation(`${this.options.address}${uri}`, requestInit);

            this.log(`  response: ${method} ${response.status} ${response.statusText} ${uri}${bodyStr ? " " + bodyStr : ""}`);
            let text = "";
            try { text = await response.text(); } catch { }

            if (!response.ok) {
                if (text) {
                    try {
                        const errJson = JSON.parse(text);
                        throw new WebDriverRequestError(errJson as ErrorResult);
                    } catch {
                        throw new WebDriverRequestError(`${response.status} ${response.statusText}`);
                    }
                }
                throw new WebDriverRequestError(`${response.status} ${response.statusText}`);
            }

            if (!text) return undefined as unknown as Result;

            let json: unknown;
            try {
                json = JSON.parse(text, withReviver(serializer));
            } catch {
                throw new WebDriverRequestError("Invalid JSON from WebDriver endpoint.");
            }

            const result = (json as { value: Result }).value;
            return result;
        } catch (cause) {
            const error = cause instanceof WebDriverRequestError ? cause : new WebDriverRequestError("WebDriver API call failed.", { cause });
            error["address"] = this.options.address;
            error["command"] = `${method} ${uri}`;
            this.log(`  error: ${error.message}`);
            throw error;
        }
    }
}

/**
 * [18.1 Print Page](https://www.w3.org/TR/webdriver2/#print-page)
 */
export interface PrintOptions {
    orientation?: "landscape" | "portrait";
    scale?: number;
    background?: boolean;
    page?: {
        pageWidth?: number;
        pageHeight?: number;
        margin?: {
            marginTop?: number;
            marginBottom?: number;
            marginLeft?: number;
            marginRight?: number;
        };
    };
    shrinkToFit?: boolean;
    pageRanges?: (number | `${number}` | `${number}-${number}`)[];
}

export class Session implements Disposable, AsyncDisposable, Serializer {

    public constructor(public readonly wdAddress: WebDriverClient, public readonly sessionId: string, public readonly capabilities: MatchingCapabilities) {
    }

    protected request<Args, Result>(method: Method, uri: string, args?: Args, signal?: AbortSignal): Promise<Result> {
        return this.wdAddress.request<Args, Result>(method, uri, args, this.withSignal(signal), this).catch(error => {
            error["sessionId"] = this.sessionId;
            throw error;
        });
    }

    /**
     * Protected virtual method for signal handling that can be overridden in context-aware instances.
     * @param signal The signal to process
     * @returns The processed signal or undefined
     */
    protected withSignal(signal?: AbortSignal): AbortSignal | undefined {
        return signal;
    }

    public serialize(value: unknown): unknown {
        if (value instanceof Element) return { [webElementIdentifier]: value[webElementIdentifier] };
        if (value instanceof ShadowRoot) return { [shadowRootIdentifier]: value[shadowRootIdentifier] };
        return value;
    }

    public deserialize(value: unknown): unknown {
        if (value && typeof value === "object" && webElementIdentifier in value) return this.element(value as WebElementReference);
        if (value && typeof value === "object" && shadowRootIdentifier in value) return this.shadowRoot(value as ShadowRootReference);
        return value;
    }

    /**
     * Creates a context-aware Session that combines signals from the context with method calls.
     * @param context The context containing a signal to be combined with method calls
     * @returns A new Session instance that automatically combines signals
     */
    public context<T extends Session>(this: T, context: { signal?: AbortSignal }): T {
        const originalSession = this;
        
        // Create a new object with the same prototype chain - no property copying
        const contextSession = Object.create(Object.getPrototypeOf(this));
        
        // Copy constructor properties
        contextSession.wdAddress = this.wdAddress;
        contextSession.sessionId = this.sessionId;
        contextSession.capabilities = this.capabilities;
        
        // Override the withSignal method to combine signals
        contextSession.withSignal = function(signal?: AbortSignal): AbortSignal | undefined {
            const baseSignal = originalSession.withSignal.call(this, signal);
            
            if (baseSignal && context.signal) {
                // Combine both signals using AbortSignal.any (Node.js 22+)
                return AbortSignal.any([baseSignal, context.signal]);
            }
            return context.signal ?? baseSignal;
        };
        
        return contextSession as T;
    }

    /**
     * [8.2 Delete Session](https://www.w3.org/TR/webdriver2/#delete-session)
     * 
     * ECMAScript Explicit Resource Management implementation
     */
    public [Symbol.dispose](): void {
        // For sync disposal, we can't await the async dispose
        // Users should prefer using `await using` with Symbol.asyncDispose
        this.request("DELETE", `/session/${this.sessionId}`, undefined).catch(() => {
            // Silently handle disposal errors in sync context
        });
    }

    /**
     * [8.2 Delete Session](https://www.w3.org/TR/webdriver2/#delete-session)
     * 
     * ECMAScript Async Explicit Resource Management implementation
     */
    public async [Symbol.asyncDispose](): Promise<void> {
        await this.request("DELETE", `/session/${this.sessionId}`, undefined);
    }

    /**
     * [9.1 Get Timeouts](https://www.w3.org/TR/webdriver2/#get-timeouts)
     */
    public async getTimeouts(signal?: AbortSignal): Promise<TimeoutsConfiguration> {
        try {
            return await this.request("GET", `/session/${this.sessionId}/timeouts`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get timeouts."`, { cause });
        }
    }

    /**
     * [9.2 Set Timeouts](https://www.w3.org/TR/webdriver2/#set-timeouts)
     */
    public async setTimeouts(timeouts: TimeoutsConfiguration, signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("POST", `/session/${this.sessionId}/timeouts`, timeouts, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to set timeouts.`, { cause }, { timeouts });
        }
    }

    /**
     * [10.1 Navigate To](https://www.w3.org/TR/webdriver2/#navigate-to)
     */
    public async navigateTo(url: string, signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("POST", `/session/${this.sessionId}/url`, { url }, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to navigate to ${url}.`, { cause }, { url });
        }
    }

    /**
     * [10.2 Get Current URL](https://www.w3.org/TR/webdriver2/#get-current-url)
     */
    public async getCurrentUrl(signal?: AbortSignal): Promise<string> {
        try {
            return await this.request("GET", `/session/${this.sessionId}/url`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get current url.`, { cause });
        }
    }

    /**
     * [10.3 Back](https://www.w3.org/TR/webdriver2/#back)
     */
    public async back(signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("POST", `/session/${this.sessionId}/back`, {}, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to go back.`, { cause });
        }
    }

    /**
     * [10.4 Forward](https://www.w3.org/TR/webdriver2/#forward)
     */
    public async forward(signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("POST", `/session/${this.sessionId}/forward`, {}, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to go forward.`, { cause });
        }
    }

    /**
     * [10.5 Refresh](https://www.w3.org/TR/webdriver2/#refresh)
     */
    public async refresh(signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("POST", `/session/${this.sessionId}/refresh`, {}, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to refresh.`, { cause });
        }
    }

    /**
     * [10.6 Get Title](https://www.w3.org/TR/webdriver2/#get-title)
     */
    public async getTitle(signal?: AbortSignal): Promise<string> {
        try {
            return await this.request("GET", `/session/${this.sessionId}/title`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get title.`, { cause });
        }
    }

    /**
     * [11.1 Get Window Handle](https://www.w3.org/TR/webdriver2/#get-window-handle)
     */
    public async getWindow(signal?: AbortSignal): Promise<Window> {
        try {
            const handle = await this.request<{}, WindowHandle>("GET", `/session/${this.sessionId}/window`, undefined, signal);
            return new Window(this, handle);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get window.`, { cause });
        }
    }

    /**
     * [11.2 Close Window](https://www.w3.org/TR/webdriver2/#close-window)
     */
    public async closeWindow(signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("DELETE", `/session/${this.sessionId}/window`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to close window.`, { cause });
        }
    }

    /**
     * [11.4 Get Window Handles](https://www.w3.org/TR/webdriver2/#get-window-handles)
     */
    public async getWindows(signal?: AbortSignal): Promise<Window[]> {
        try {
            const handles = await this.request<{}, WindowHandle[]>("GET", `/session/${this.sessionId}/window/handles`, undefined, signal);
            return handles.map(handle => new Window(this, handle));
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get windows.`, { cause });
        }
    }

    /**
     * [11.5 New Window](https://www.w3.org/TR/webdriver2/#new-window)
     */
    public async newWindow(type: "tab" | "window" = "tab", signal?: AbortSignal): Promise<Window> {
        try {
            const res = await this.request<{ type: "tab" | "window" }, { handle: WindowHandle, type: "tab" | "window" }>("POST", `/session/${this.sessionId}/window/new`, { type }, signal);
            return new Window(this, res.handle, res.type);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to open a new window.`, { cause }, { type });
        }
    }

    /**
     * [11.6 Switch To Frame](https://www.w3.org/TR/webdriver2/#switch-to-frame)
     */
    public async switchToFrame(frame: null | number | Element | WebElementReference, signal?: AbortSignal): Promise<void> {
        try {
            let id: null | number | WebElementReference;
            if (frame === null || typeof frame === "number") {
                id = frame;
            } else if (frame instanceof Element) {
                id = { [webElementIdentifier]: frame.elementId };
            } else if (typeof frame === "object" && webElementIdentifier in frame) {
                id = frame;
            } else {
                throw new Error("Invalid frame reference");
            }
            return await this.request("POST", `/session/${this.sessionId}/frame`, { id }, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to switch to frame.`, { cause }, { frame });
        }
    }

    /**
     * [11.7 Switch To Parent Frame](https://www.w3.org/TR/webdriver2/#switch-to-parent-frame)
     */
    public async switchToParentFrame(signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("POST", `/session/${this.sessionId}/frame/parent`, {}, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to switch to parent frame.`, { cause });
        }
    }

    /**
     * [11.8.1 Get Window Rect](https://www.w3.org/TR/webdriver2/#get-window-rect)
     */
    public async getWindowRect(signal?: AbortSignal): Promise<WindowRect> {
        try {
            return await this.request("GET", `/session/${this.sessionId}/window/rect`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get window rect.`, { cause });
        }
    }

    /**
     * [11.8.2 Set Window Rect](https://www.w3.org/TR/webdriver2/#set-window-rect)
     */
    public async setWindowRect(windowRect: { x: null | number, y: null | number, width: null | number, height: null | number }, signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("POST", `/session/${this.sessionId}/window/rect`, windowRect, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to set window rect.`, { cause }, { windowRect });
        }
    }

    /**
     * [11.8.3 Maximize Window](https://www.w3.org/TR/webdriver2/#maximize-window)
     */
    public async maximize(signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("POST", `/session/${this.sessionId}/window/maximize`, {}, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to maximize.`, { cause });
        }
    }

    /**
     * [11.8.4 Minimize Window](https://www.w3.org/TR/webdriver2/#minimize-window)
     */
    public async minimize(signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("POST", `/session/${this.sessionId}/window/minimize`, {}, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to minimize.`, { cause });
        }
    }

    /**
     * [11.8.5 Fullscreen Window](https://www.w3.org/TR/webdriver2/#fullscreen-window)
     */
    public async fullscreen(signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("POST", `/session/${this.sessionId}/window/fullscreen`, {}, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to go fullscreen.`, { cause });
        }
    }

    /**
     * [12.3.2 Find Element](https://www.w3.org/TR/webdriver2/#find-element)
     */
    public async findElement(lookup: ElementLookup, signal?: AbortSignal): Promise<Element> {
        try {
            return await this.request<ElementLookup, Element>("POST", `/session/${this.sessionId}/element`, lookup, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to find element by ${lookup.using} "${lookup.value}".`, { cause }, { lookup });
        }
    }

    /**
     * [12.3.3 Find Elements](https://www.w3.org/TR/webdriver2/#find-elements)
     */
    public async findElements(lookup: ElementLookup, signal?: AbortSignal): Promise<Element[]> {
        try {
            return await this.request<ElementLookup, Element[]>("POST", `/session/${this.sessionId}/elements`, lookup, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to find elements by ${lookup.using} "${lookup.value}".`, { cause }, { lookup });
        }
    }

    /**
     * [12.3.8 Get Active Element](https://www.w3.org/TR/webdriver2/#get-active-element)
     */
    public async getActiveElement(signal?: AbortSignal): Promise<Element> {
        try {
            return await this.element(await this.request<{}, WebElementReference>("GET", `/session/${this.sessionId}/element/active`, undefined, signal));
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get active element.`, { cause });
        }
    }

    /**
     * [13.1 Get Page Source](https://www.w3.org/TR/webdriver2/#get-page-source)
     */
    public async getPageSource(signal?: AbortSignal): Promise<string> {
        try {
            return await this.request("GET", `/session/${this.sessionId}/source`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get page source.`, { cause });
        }
    }

    /**
     * [13.2.1 Execute Script](https://www.w3.org/TR/webdriver2/#execute-script)
     */
    public async executeScript(script: string, signal?: AbortSignal, ...args: unknown[]): Promise<unknown> {
        try {
            return await this.request("POST", `/session/${this.sessionId}/execute/sync`, { script, args }, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to execute script.`, { cause });
        }
    }

    /**
     * [13.2.2 Execute Async Script](https://www.w3.org/TR/webdriver2/#execute-async-script)
     */
    public async executeScriptAsync(script: string, signal?: AbortSignal, ...args: unknown[]): Promise<unknown> {
        try {
            return await this.request("POST", `/session/${this.sessionId}/execute/async`, { script, args }, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to execute script async.`, { cause });
        }
    }

    /**
     * [14.1 Get All Cookies](https://www.w3.org/TR/webdriver2/#get-all-cookies)
     */
    public async getCookies(signal?: AbortSignal): Promise<Cookie[]> {
        try {
            return await this.request("GET", `/session/${this.sessionId}/cookie`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get cookies.`, { cause });
        }
    }

    /**
     * [14.2 Get Named Cookie](https://www.w3.org/TR/webdriver2/#get-named-cookie)
     */
    public async getNamedCookie(name: string, signal?: AbortSignal): Promise<Cookie> {
        try {
            return await this.request("GET", `/session/${this.sessionId}/cookie/${name}`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get named cookie '${name}'.`, { cause }, { name });
        }
    }

    /**
     * [14.3 Add Cookie](https://www.w3.org/TR/webdriver2/#add-cookie)
     */
    public async addCookie(cookie: Cookie, signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("POST", `/session/${this.sessionId}/cookie`, { cookie }, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to add cookie '${cookie.name}'.`, { cause }, { cookie });
        }
    }

    /**
     * [14.4 Delete Cookie](https://www.w3.org/TR/webdriver2/#delete-cookie)
     */
    public async deleteCookie(name: string, signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("DELETE", `/session/${this.sessionId}/cookie/${name}`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to delete cookie '${name}'.`, { cause }, { name });
        }
    }

    /**
     * [14.5 Delete All Cookies](https://www.w3.org/TR/webdriver2/#delete-all-cookies)
     */
    public async deleteAllCookies(signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("DELETE", `/session/${this.sessionId}/cookie`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to delete all cookies.`, { cause });
        }
    }

    /**
     * [15.7 Perform Actions](https://www.w3.org/TR/webdriver2/#perform-actions)
     */
    public async performActions(actions: ActionSequence[], signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("POST", `/session/${this.sessionId}/actions`, { actions }, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to perform actions.`, { cause });
        }
    }

    /**
     * [15.8 Release Actions](https://www.w3.org/TR/webdriver2/#release-actions)
     */
    public async releaseActions(signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("DELETE", `/session/${this.sessionId}/actions`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to release actions.`, { cause });
        }
    }

    /**
     * [16.1 Dismiss Alert](https://www.w3.org/TR/webdriver2/#dismiss-alert)
     */
    public async dismissAlert(signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("POST", `/session/${this.sessionId}/alert/dismiss`, {}, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to dismiss alert.`, { cause });
        }
    }

    /**
     * [16.2 Accept Alert](https://www.w3.org/TR/webdriver2/#accept-alert)
     */
    public async acceptAlert(signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("POST", `/session/${this.sessionId}/alert/accept`, {}, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to accept alert.`, { cause });
        }
    }

    /**
     * [16.3 Get Alert Text](https://www.w3.org/TR/webdriver2/#get-alert-text)
     */
    public async getAlertText(signal?: AbortSignal): Promise<string> {
        try {
            return await this.request("GET", `/session/${this.sessionId}/alert/text`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get alert.`, { cause });
        }
    }

    /**
     * [16.4 Send Alert Text](https://www.w3.org/TR/webdriver2/#send-alert-text)
     */
    public async sendAlertText(signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("POST", `/session/${this.sessionId}/alert/text`, {}, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to send alert text.`, { cause });
        }
    }

    /**
     * [17.1 Take Screenshot](https://www.w3.org/TR/webdriver2/#take-screenshot)
     */
    public async takeScreenshot(signal?: AbortSignal): Promise<Base64PNG> {
        try {
            return await this.request("GET", `/session/${this.sessionId}/screenshot`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to take screenshot.`, { cause });
        }
    }

    /**
     * [18.1 Print Page](https://www.w3.org/TR/webdriver2/#print-page)
     */
    public async printPage(printOptions?: PrintOptions, signal?: AbortSignal): Promise<string> {
        try {
            return await this.request<PrintOptions, string>("POST", `/session/${this.sessionId}/print`, printOptions ?? {}, signal)
        } catch (cause) {
            throw new WebDriverMethodError("Failed to print page.", { cause }, printOptions && { printOptions });
        }
    }

    /**
     * Deserialize an {@link Element} by {@link WebElementReference} within this session.
     */
    public element(elementRef: WebElementReference, _signal?: AbortSignal): Element {
        return new Element(this, elementRef[webElementIdentifier]);
    }

    /**
     * Deserialize a {@link ShadowRoot} by {@link ShadowRootReference} within this session.
     */
    public shadowRoot(shadowRootRef: ShadowRootReference, _signal?: AbortSignal): ShadowRoot {
        return new ShadowRoot(this, shadowRootRef[shadowRootIdentifier]);
    }
}

export class Window {
    constructor(
        public readonly session: Session,
        public readonly handle: WindowHandle,
        /**
         * If the {@link Window} was obtained using {@link Session.getWindow}, type is `undefined`.
         * 
         * If the {@link Window} was created using {@link Session.newWindow}, type is `"tab"` or `"window"`.
         */
        public readonly type: undefined | "window" | "tab" = undefined) {
    }

    public get sessionId() {
        return this.session.sessionId;
    }

    /**
     * [11.3 Switch To Window](https://www.w3.org/TR/webdriver2/#switch-to-window)
     */
    public async switchToWindow(signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("POST", `/session/${this.sessionId}/window`, { handle: this.handle }, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to switch to window ${this.handle}.`, { cause });
        }
    }

    protected request<Args, Result>(method: Method, uri: string, args?: Args, signal?: AbortSignal): Promise<Result> {
        return this.session.wdAddress.request<Args, Result>(method, uri, args, signal, this.session).catch(error => {
            error["handle"] = this.handle;
            throw error;
        });
    }
}

export interface ElementRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * A Base64 encoded PNG.
 */
export type Base64PNG = string;

export class Element implements WebElementReference {
    constructor(public readonly session: Session, public readonly elementId: ElementId) {
    }

    public get [webElementIdentifier](): ElementId {
        return this.elementId;
    }

    public get sessionId(): string {
        return this.session.sessionId;
    }

    /**
     * Switch to this element’s frame
     */
    public async switchToFrame(signal?: AbortSignal): Promise<void> {
        try {
            const id: WebElementReference = { [webElementIdentifier]: this.elementId };
            return await this.request("POST", `/session/${this.sessionId}/frame`, { id }, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to switch to frame from element.`, { cause });
        }
    }

    /**
     * [12.3.4 Find Element From Element](https://www.w3.org/TR/webdriver2/#find-element-from-element)
     */
    public async findElement(lookup: ElementLookup, signal?: AbortSignal): Promise<Element> {
        try {
            return await this.request<ElementLookup, Element>("POST", `/session/${this.sessionId}/element/${this.elementId}/element`, lookup, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to find element by ${lookup.using} "${lookup.value}" from element.`, { cause }, { lookup });
        }
    }

    /**
     * [12.3.5 Find Elements From Element](https://www.w3.org/TR/webdriver2/#find-elements-from-element)
     */
    public async findElements(lookup: ElementLookup, signal?: AbortSignal): Promise<Element[]> {
        try {
            return await this.request<ElementLookup, Element[]>("POST", `/session/${this.sessionId}/element/${this.elementId}/elements`, lookup, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to find elements by ${lookup.using} "${lookup.value}" from element.`, { cause }, { lookup });
        }
    }

    /**
     * [12.3.9 Get Element Shadow Root](https://www.w3.org/TR/webdriver2/#get-element-shadow-root)
     */
    public async shadowRoot(signal?: AbortSignal): Promise<ShadowRoot> {
        try {
            return await this.request<{}, ShadowRoot>("GET", `/session/${this.sessionId}/element/${this.elementId}/shadow`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get shadowRoot from element.`, { cause });
        }
    }

    /**
     * [12.4.1 Is Element Selected](https://www.w3.org/TR/webdriver2/#is-element-selected)
     */
    public async isSelected(signal?: AbortSignal): Promise<boolean> {
        try {
            return await this.request("GET", `/session/${this.sessionId}/element/${this.elementId}/selected`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get isSelected from element.`, { cause });
        }
    }

    /**
     * [12.4.2 Get Element Attribute](https://www.w3.org/TR/webdriver2/#get-element-attribute)
     */
    public async getAttribute(name: string, signal?: AbortSignal): Promise<null | string> {
        try {
            return await this.request<{}, null | string>("GET", `/session/${this.sessionId}/element/${this.elementId}/attribute/${name}`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get attribute ${name} from element.`, { cause }, { name });
        }
    }

    /**
     * [12.4.3 Get Element Property](https://www.w3.org/TR/webdriver2/#get-element-property)
     */
    public async getProperty(name: string, signal?: AbortSignal): Promise<unknown> {
        try {
            return await this.request<{}, unknown>("GET", `/session/${this.sessionId}/element/${this.elementId}/property/${name}`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get property ${name} from element.`, { cause }, { name });
        }
    }

    /**
     * [12.4.4 Get Element CSS Value](https://www.w3.org/TR/webdriver2/#get-element-css-value)
     */
    public async getCSSValue(name: string, signal?: AbortSignal): Promise<string> {
        try {
            return await this.request<{}, string>("GET", `/session/${this.sessionId}/element/${this.elementId}/css/${name}`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get css value ${name} from element.`, { cause }, { name });
        }
    }

    /**
     * [12.4.5 Get Element Text](https://www.w3.org/TR/webdriver2/#get-element-text)
     */
    public async getText(signal?: AbortSignal): Promise<string> {
        try {
            return await this.request<{}, string>("GET", `/session/${this.sessionId}/element/${this.elementId}/text`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get text from element.`, { cause });
        }
    }

    /**
     * [12.4.6 Get Element Tag Name](https://www.w3.org/TR/webdriver2/#get-element-tag-name)
     */
    public async getTagName(signal?: AbortSignal): Promise<string> {
        try {
            return await this.request<{}, string>("GET", `/session/${this.sessionId}/element/${this.elementId}/name`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get tag name from element.`, { cause });
        }
    }

    /**
     * The Get Element Rect command returns the dimensions and coordinates of the given web element.
     */
    public async getRect(signal?: AbortSignal): Promise<ElementRect> {
        try {
            return await this.request<{}, ElementRect>("GET", `/session/${this.sessionId}/element/${this.elementId}/rect`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get rect from element.`, { cause });
        }
    }

    /**
     * [12.4.8 Is Element Enabled](https://www.w3.org/TR/webdriver2/#is-element-enabled)
     */
    public async isEnabled(signal?: AbortSignal): Promise<boolean> {
        try {
            return await this.request<{}, boolean>("GET", `/session/${this.sessionId}/element/${this.elementId}/enabled`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get isEnabled from element.`, { cause });
        }
    }

    /**
     * [12.4.9 Get Computed Role](https://www.w3.org/TR/webdriver2/#get-computed-role)
     */
    public async getComputedRole(signal?: AbortSignal): Promise<string> {
        try {
            return await this.request<{}, string>("GET", `/session/${this.sessionId}/element/${this.elementId}/computedrole`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get computed role from element.`, { cause });
        }
    }

    /**
     * [12.4.10 Get Computed Label](https://www.w3.org/TR/webdriver2/#get-computed-label)
     */
    public async getComputedLabel(signal?: AbortSignal): Promise<string> {
        try {
            return await this.request<{}, string>("GET", `/session/${this.sessionId}/element/${this.elementId}/computedlabel`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to get computed label from element.`, { cause });
        }
    }

    /**
     * [12.5.1 Element Click](https://www.w3.org/TR/webdriver2/#element-click)
     */
    public async click(signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("POST", `/session/${this.sessionId}/element/${this.elementId}/click`, {}, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to click element.`, { cause });
        }
    }

    /**
     * [12.5.2 Element Clear](https://www.w3.org/TR/webdriver2/#element-clear)
     */
    public async clear(signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("POST", `/session/${this.sessionId}/element/${this.elementId}/clear`, {}, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to clear element.`, { cause });
        }
    }

    /**
     * [12.5.3 Element Send Keys](https://www.w3.org/TR/webdriver2/#element-send-keys)
     */
    public async sendKeys(text: string, signal?: AbortSignal): Promise<void> {
        try {
            return await this.request("POST", `/session/${this.sessionId}/element/${this.elementId}/value`, { text }, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to send text to element.`, { cause }, {
                text: text?.length > 50 ? text?.substring(0, 50) + "..." : text
            });
        }
    }

    /**
     * [17.2 Take Element Screenshot](https://www.w3.org/TR/webdriver2/#take-element-screenshot)
     */
    public async takeScreenshot(signal?: AbortSignal): Promise<Base64PNG> {
        try {
            return await this.request("GET", `/session/${this.sessionId}/element/${this.elementId}/screenshot`, undefined, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to take a screenshot of element.`, { cause });
        }
    }

    protected request<Args, Result>(method: Method, uri: string, args?: Args, signal?: AbortSignal): Promise<Result> {
        return this.session.wdAddress.request<Args, Result>(method, uri, args, signal, this.session).catch(error => {
            error["sessionId"] = this.sessionId;
            error["elementId"] = this.elementId;
            throw error;
        });
    }
}

export class ShadowRoot implements ShadowRootReference {

    public constructor(private readonly session: Session, private readonly shadowId: ShadowRootId) {
    }

    public get [shadowRootIdentifier]() {
        return this.shadowId;
    }

    public get sessionId() {
        return this.session.sessionId;
    }

    /**
     * [12.3.6 Find Element From Shadow Root](https://www.w3.org/TR/webdriver2/#find-element-from-shadow-root)
     */
    public async findElement(lookup: ElementLookup, signal?: AbortSignal): Promise<Element> {
        try {
            return await this.request<ElementLookup, Element>("POST", `/session/${this.sessionId}/shadow/${this.shadowId}/element`, lookup, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to find element by ${lookup.using} "${lookup.value}" from shadow root.`, { cause }, { lookup });
        }
    }

    /**
     * [12.3.7 Find Elements From Shadow Root](https://www.w3.org/TR/webdriver2/#find-elements-from-shadow-root)
     */
    public async findElements(lookup: ElementLookup, signal?: AbortSignal): Promise<Element[]> {
        try {
            return await this.request<ElementLookup, Element[]>("POST", `/session/${this.sessionId}/shadow/${this.shadowId}/elements`, lookup, signal);
        } catch (cause) {
            throw new WebDriverMethodError(`Failed to find elements by ${lookup.using} "${lookup.value}" from shadow root.`, { cause }, { lookup });
        }
    }

    protected request<Args, Result>(method: Method, uri: string, args?: Args, signal?: AbortSignal): Promise<Result> {
        return this.session.wdAddress.request<Args, Result>(method, uri, args, signal, this.session).catch(error => {
            error["sessionId"] = this.sessionId;
            error["shadowId"] = this.shadowId;
            throw error;
        });
    }
}
