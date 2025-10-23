/**
 * ECMAScript Explicit Resource Management (ES2024)
 * Requires Node.js 22+ for Symbol.dispose support
 */
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
    };
}
export declare class WebDriverMethodError extends Error {
    constructor(error?: string, options?: ErrorOptions, args?: {});
}
export declare class WebDriverRequestError extends Error {
    constructor(error: string | ErrorResult, options?: ErrorOptions);
}
/**
 * [7.1 Proxy](https://www.w3.org/TR/webdriver2/#proxy)
 */
export type Proxy = {
    /**
     * Indicates the type of proxy configuration.
     */
    proxyType: "pac";
    /**
     * Defines the URL for a proxy auto-config file if proxyType is equal to "pac".
     * Any URL.
     */
    proxyAutoconfigUrl: string;
} | {
    /**
     * Indicates the type of proxy configuration.
     */
    proxyType: "direct" | "autodetect" | "system";
} | {
    /**
     * Indicates the type of proxy configuration.
     */
    proxyType: "manual";
    /**
     * Defines the proxy host for FTP traffic when the proxyType is "manual".
     * A host and optional port for scheme "ftp".
     */
    ftpProxy?: string;
    /**
     * Defines the proxy host for HTTP traffic when the proxyType is "manual".
     * A host and optional port for scheme "http".
     */
    httpProxy?: string;
    /**
     * Lists the address for which the proxy should be bypassed when the proxyType is "manual".
     * A List containing any number of Strings.
     */
    noProxy?: string[];
    /**
     * Defines the proxy host for encrypted TLS traffic when the proxyType is "manual".
     * A host and optional port for scheme "https".
     */
    sslProxy?: string;
    /**
     * Defines the proxy host for a SOCKS proxy when the proxyType is "manual".
     * A host and optional port with an undefined scheme.
     */
    socksProxy?: string;
    /**
     * Defines the SOCKS proxy version when the proxyType is "manual".
     * Any integer between 0 and 255 inclusive.
     */
    socksVersion?: number;
};
/**
 * [7.2 Processing capabilities](https://www.w3.org/TR/webdriver2/#processing-capabilities)
 */
export interface ProcessCapabilities {
    capabilities: {
        alwaysMatch: ValidateCapabilities;
        firstMatch: ValidateCapabilities[];
    };
}
/**
 * [7.2 Processing capabilities](https://www.w3.org/TR/webdriver2/#processing-capabilities)
 */
export interface ValidateCapabilities {
    acceptInsecureCerts?: boolean;
    browserName?: string;
    browserVersion?: string;
    platformName?: string;
    pageLoadStrategy?: PageLoadStrategy;
    proxy?: Proxy;
    strictFileInteractability?: boolean;
    timeouts?: TimeoutsConfiguration;
    unhandledPromptBehavior?: UnhandledPromptBehavior;
    /**
     * An additional WebDriver capability
     * or
     * The key of an extension capability
     */
    [key: `${string}:${string}`]: unknown;
}
/**
 * [7.2 Processing capabilities](https://www.w3.org/TR/webdriver2/#processing-capabilities)
 */
export interface MatchingCapabilities {
    /**
     * ASCII Lowercase name of the user agent as a string.
     */
    browserName: string;
    /**
     * The user agent version, as a string.
     */
    browserVersion: string;
    /**
     * ASCII Lowercase name of the current platform as a string.
     */
    platformName: string;
    /**
     * Boolean initially set to false, indicating the session will not implicitly trust untrusted or self-signed TLS certificates on navigation.
     */
    acceptInsecureCerts: boolean;
    /**
     * Boolean initially set to false, indicating that interactability checks will be applied to <input type=file>.
     */
    strictFileInteractability: boolean;
    /**
     * Boolean indicating whether the remote end supports all of the resizing and positioning commands.
     */
    setWindowRect: boolean;
    proxy?: Proxy;
    /**
     * Optionally add extension capabilities as entries to matched capabilities.
     */
    [key: string]: unknown;
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
};
/**
 * [10. Navigation](https://www.w3.org/TR/webdriver2/#navigation)
 */
export declare enum PageLoadStrategy {
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
declare const webElementIdentifier = "element-6066-11e4-a52e-4f735466cecf";
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
declare const shadowRootIdentifier = "shadow-6066-11e4-a52e-4f735466cecf";
interface ShadowRootReference {
    readonly [shadowRootIdentifier]: ShadowRootId;
}
/**
 * [12.3.1 Locator strategies](https://www.w3.org/TR/webdriver2/#locator-strategies)
 */
export declare enum LocatorStrategy {
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
    using: "css selector";
    /**
     * The search CSS selector.
     */
    value: string;
}
/**
 * [12.3.1.2 Link text](https://www.w3.org/TR/webdriver2/#link-text)
 */
export interface LinkText {
    using: "link text";
    /**
     * The link text to look for.
     */
    value: string;
}
/**
 * [12.3.1.3 Partial link text](https://www.w3.org/TR/webdriver2/#partial-link-text)
 */
export interface PartialLinkText {
    using: "partial link text";
    /**
     * The partial link text to look for.
     */
    value: string;
}
/**
 * [12.3.1.4 Tag name](https://www.w3.org/TR/webdriver2/#tag-name)
 */
export interface TagName {
    using: "tag name";
    /**
     * The tag name of the the element to look for.
     */
    value: string;
}
/**
 * [12.3.1.5 XPath](https://www.w3.org/TR/webdriver2/#xpath)
 */
export interface XPathSelector {
    using: "xpath";
    /**
     * The XPath query to search with.
     */
    value: string;
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
export declare namespace by {
    const css: (cssSelector: string) => CSSSelector;
    const link: (linkText: string) => LinkText;
    const partialLink: (partialLinkText: string) => PartialLinkText;
    const tagName: (tag: string) => TagName;
    const xPath: (xPath: string) => XPathSelector;
}
export type SingleUnicodeCodePoint = string;
export declare namespace Actions {
    interface Pause {
        type: "pause";
        duration: number;
    }
    interface KeyUp {
        type: "keyUp";
        /**
         * Key. A String containing a single unicode code point.
         */
        value: string;
    }
    interface KeyDown {
        type: "keyDown";
        /**
         * Key. A String containing a single unicode code point.
         */
        value: string;
    }
    interface PointerState {
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
    interface PointerUp extends PointerState {
        type: "pointerUp";
        button: number;
    }
    interface PointerDown extends PointerState {
        type: "pointerDown";
        button: number;
    }
    interface PointerMove extends PointerState {
        type: "pointerMove";
        duration: number;
        /**
         * A `"viewport"` or `"pointer"` constants, or an {@link Element}.
         */
        origin?: "viewport" | "pointer" | WebElementReference;
        x: number;
        y: number;
    }
    interface PointerCancel {
        type: "pointerCancel";
    }
    interface Scroll {
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
export declare enum UnhandledPromptBehavior {
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
export declare class WebDriverClient {
    readonly options: WebDriverClientOptions;
    readonly fetchImplementation: typeof fetch;
    constructor(options: WebDriverClientOptions, fetchImplementation?: typeof fetch);
    get prefix(): string;
    protected log(line: string): void;
    /**
     * Protected virtual method for signal handling that can be overridden in context-aware instances.
     * @param signal The signal to process
     * @returns The processed signal or undefined
     */
    protected withSignal(signal?: AbortSignal): AbortSignal | undefined;
    /**
     * Creates a context-aware WebDriverClient that combines signals from the context with method calls.
     * @param context The context containing a signal to be combined with method calls
     * @returns A new WebDriverClient instance that automatically combines signals
     */
    context<T extends WebDriverClient>(this: T, context: {
        signal?: AbortSignal;
    }): T;
    /**
     * 8.1 New Session
     * https://www.w3.org/TR/webdriver2/#new-session
     */
    newSession(options: ProcessCapabilities | {
        capabilities: ValidateCapabilities;
    }, signal?: AbortSignal): Promise<Session>;
    /**
     * 8.3 Status
     * https://www.w3.org/TR/webdriver2/#status
     */
    status(signal?: AbortSignal): Promise<{
        ready: boolean;
        message: string;
        [other: string]: unknown;
    }>;
    request<Args, Result>(method: Method, uri: string, args?: Args, signal?: AbortSignal, serializer?: Serializer): Promise<Result>;
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
export declare class Session implements Disposable, AsyncDisposable, Serializer {
    readonly wdAddress: WebDriverClient;
    readonly sessionId: string;
    readonly capabilities: MatchingCapabilities;
    constructor(wdAddress: WebDriverClient, sessionId: string, capabilities: MatchingCapabilities);
    protected request<Args, Result>(method: Method, uri: string, args?: Args, signal?: AbortSignal): Promise<Result>;
    /**
     * Protected virtual method for signal handling that can be overridden in context-aware instances.
     * @param signal The signal to process
     * @returns The processed signal or undefined
     */
    protected withSignal(signal?: AbortSignal): AbortSignal | undefined;
    serialize(value: unknown): unknown;
    deserialize(value: unknown): unknown;
    /**
     * Creates a context-aware Session that combines signals from the context with method calls.
     * @param context The context containing a signal to be combined with method calls
     * @returns A new Session instance that automatically combines signals
     */
    context<T extends Session>(this: T, context: {
        signal?: AbortSignal;
    }): T;
    /**
     * [8.2 Delete Session](https://www.w3.org/TR/webdriver2/#delete-session)
     *
     * ECMAScript Explicit Resource Management implementation
     */
    [Symbol.dispose](): void;
    /**
     * [8.2 Delete Session](https://www.w3.org/TR/webdriver2/#delete-session)
     *
     * ECMAScript Async Explicit Resource Management implementation
     */
    [Symbol.asyncDispose](): Promise<void>;
    /**
     * [9.1 Get Timeouts](https://www.w3.org/TR/webdriver2/#get-timeouts)
     */
    getTimeouts(signal?: AbortSignal): Promise<TimeoutsConfiguration>;
    /**
     * [9.2 Set Timeouts](https://www.w3.org/TR/webdriver2/#set-timeouts)
     */
    setTimeouts(timeouts: TimeoutsConfiguration, signal?: AbortSignal): Promise<void>;
    /**
     * [10.1 Navigate To](https://www.w3.org/TR/webdriver2/#navigate-to)
     */
    navigateTo(url: string, signal?: AbortSignal): Promise<void>;
    /**
     * [10.2 Get Current URL](https://www.w3.org/TR/webdriver2/#get-current-url)
     */
    getCurrentUrl(signal?: AbortSignal): Promise<string>;
    /**
     * [10.3 Back](https://www.w3.org/TR/webdriver2/#back)
     */
    back(signal?: AbortSignal): Promise<void>;
    /**
     * [10.4 Forward](https://www.w3.org/TR/webdriver2/#forward)
     */
    forward(signal?: AbortSignal): Promise<void>;
    /**
     * [10.5 Refresh](https://www.w3.org/TR/webdriver2/#refresh)
     */
    refresh(signal?: AbortSignal): Promise<void>;
    /**
     * [10.6 Get Title](https://www.w3.org/TR/webdriver2/#get-title)
     */
    getTitle(signal?: AbortSignal): Promise<string>;
    /**
     * [11.1 Get Window Handle](https://www.w3.org/TR/webdriver2/#get-window-handle)
     */
    getWindow(signal?: AbortSignal): Promise<Window>;
    /**
     * [11.2 Close Window](https://www.w3.org/TR/webdriver2/#close-window)
     */
    closeWindow(signal?: AbortSignal): Promise<void>;
    /**
     * [11.4 Get Window Handles](https://www.w3.org/TR/webdriver2/#get-window-handles)
     */
    getWindows(signal?: AbortSignal): Promise<Window[]>;
    /**
     * [11.5 New Window](https://www.w3.org/TR/webdriver2/#new-window)
     */
    newWindow(type?: "tab" | "window", signal?: AbortSignal): Promise<Window>;
    /**
     * [11.6 Switch To Frame](https://www.w3.org/TR/webdriver2/#switch-to-frame)
     */
    switchToFrame(frame: null | number | Element | WebElementReference, signal?: AbortSignal): Promise<void>;
    /**
     * [11.7 Switch To Parent Frame](https://www.w3.org/TR/webdriver2/#switch-to-parent-frame)
     */
    switchToParentFrame(signal?: AbortSignal): Promise<void>;
    /**
     * [11.8.1 Get Window Rect](https://www.w3.org/TR/webdriver2/#get-window-rect)
     */
    getWindowRect(signal?: AbortSignal): Promise<WindowRect>;
    /**
     * [11.8.2 Set Window Rect](https://www.w3.org/TR/webdriver2/#set-window-rect)
     */
    setWindowRect(windowRect: {
        x: null | number;
        y: null | number;
        width: null | number;
        height: null | number;
    }, signal?: AbortSignal): Promise<void>;
    /**
     * [11.8.3 Maximize Window](https://www.w3.org/TR/webdriver2/#maximize-window)
     */
    maximize(signal?: AbortSignal): Promise<void>;
    /**
     * [11.8.4 Minimize Window](https://www.w3.org/TR/webdriver2/#minimize-window)
     */
    minimize(signal?: AbortSignal): Promise<void>;
    /**
     * [11.8.5 Fullscreen Window](https://www.w3.org/TR/webdriver2/#fullscreen-window)
     */
    fullscreen(signal?: AbortSignal): Promise<void>;
    /**
     * [12.3.2 Find Element](https://www.w3.org/TR/webdriver2/#find-element)
     */
    findElement(lookup: ElementLookup, signal?: AbortSignal): Promise<Element>;
    /**
     * [12.3.3 Find Elements](https://www.w3.org/TR/webdriver2/#find-elements)
     */
    findElements(lookup: ElementLookup, signal?: AbortSignal): Promise<Element[]>;
    /**
     * [12.3.8 Get Active Element](https://www.w3.org/TR/webdriver2/#get-active-element)
     */
    getActiveElement(signal?: AbortSignal): Promise<Element>;
    /**
     * [13.1 Get Page Source](https://www.w3.org/TR/webdriver2/#get-page-source)
     */
    getPageSource(signal?: AbortSignal): Promise<string>;
    /**
     * [13.2.1 Execute Script](https://www.w3.org/TR/webdriver2/#execute-script)
     */
    executeScript(script: string, signal?: AbortSignal, ...args: unknown[]): Promise<unknown>;
    /**
     * [13.2.2 Execute Async Script](https://www.w3.org/TR/webdriver2/#execute-async-script)
     */
    executeScriptAsync(script: string, signal?: AbortSignal, ...args: unknown[]): Promise<unknown>;
    /**
     * [14.1 Get All Cookies](https://www.w3.org/TR/webdriver2/#get-all-cookies)
     */
    getCookies(signal?: AbortSignal): Promise<Cookie[]>;
    /**
     * [14.2 Get Named Cookie](https://www.w3.org/TR/webdriver2/#get-named-cookie)
     */
    getNamedCookie(name: string, signal?: AbortSignal): Promise<Cookie>;
    /**
     * [14.3 Add Cookie](https://www.w3.org/TR/webdriver2/#add-cookie)
     */
    addCookie(cookie: Cookie, signal?: AbortSignal): Promise<void>;
    /**
     * [14.4 Delete Cookie](https://www.w3.org/TR/webdriver2/#delete-cookie)
     */
    deleteCookie(name: string, signal?: AbortSignal): Promise<void>;
    /**
     * [14.5 Delete All Cookies](https://www.w3.org/TR/webdriver2/#delete-all-cookies)
     */
    deleteAllCookies(signal?: AbortSignal): Promise<void>;
    /**
     * [15.7 Perform Actions](https://www.w3.org/TR/webdriver2/#perform-actions)
     */
    performActions(actions: ActionSequence[], signal?: AbortSignal): Promise<void>;
    /**
     * [15.8 Release Actions](https://www.w3.org/TR/webdriver2/#release-actions)
     */
    releaseActions(signal?: AbortSignal): Promise<void>;
    /**
     * [16.1 Dismiss Alert](https://www.w3.org/TR/webdriver2/#dismiss-alert)
     */
    dismissAlert(signal?: AbortSignal): Promise<void>;
    /**
     * [16.2 Accept Alert](https://www.w3.org/TR/webdriver2/#accept-alert)
     */
    acceptAlert(signal?: AbortSignal): Promise<void>;
    /**
     * [16.3 Get Alert Text](https://www.w3.org/TR/webdriver2/#get-alert-text)
     */
    getAlertText(signal?: AbortSignal): Promise<string>;
    /**
     * [16.4 Send Alert Text](https://www.w3.org/TR/webdriver2/#send-alert-text)
     */
    sendAlertText(signal?: AbortSignal): Promise<void>;
    /**
     * [17.1 Take Screenshot](https://www.w3.org/TR/webdriver2/#take-screenshot)
     */
    takeScreenshot(signal?: AbortSignal): Promise<Base64PNG>;
    /**
     * [18.1 Print Page](https://www.w3.org/TR/webdriver2/#print-page)
     */
    printPage(printOptions?: PrintOptions, signal?: AbortSignal): Promise<string>;
    /**
     * Deserialize an {@link Element} by {@link WebElementReference} within this session.
     */
    element(elementRef: WebElementReference, _signal?: AbortSignal): Element;
    /**
     * Deserialize a {@link ShadowRoot} by {@link ShadowRootReference} within this session.
     */
    shadowRoot(shadowRootRef: ShadowRootReference, _signal?: AbortSignal): ShadowRoot;
}
export declare class Window {
    readonly session: Session;
    readonly handle: WindowHandle;
    /**
     * If the {@link Window} was obtained using {@link Session.getWindow}, type is `undefined`.
     *
     * If the {@link Window} was created using {@link Session.newWindow}, type is `"tab"` or `"window"`.
     */
    readonly type: undefined | "window" | "tab";
    constructor(session: Session, handle: WindowHandle, 
    /**
     * If the {@link Window} was obtained using {@link Session.getWindow}, type is `undefined`.
     *
     * If the {@link Window} was created using {@link Session.newWindow}, type is `"tab"` or `"window"`.
     */
    type?: undefined | "window" | "tab");
    get sessionId(): string;
    /**
     * [11.3 Switch To Window](https://www.w3.org/TR/webdriver2/#switch-to-window)
     */
    switchToWindow(signal?: AbortSignal): Promise<void>;
    protected request<Args, Result>(method: Method, uri: string, args?: Args, signal?: AbortSignal): Promise<Result>;
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
export declare class Element implements WebElementReference {
    readonly session: Session;
    readonly elementId: ElementId;
    constructor(session: Session, elementId: ElementId);
    get [webElementIdentifier](): ElementId;
    get sessionId(): string;
    /**
     * Switch to this element’s frame
     */
    switchToFrame(signal?: AbortSignal): Promise<void>;
    /**
     * [12.3.4 Find Element From Element](https://www.w3.org/TR/webdriver2/#find-element-from-element)
     */
    findElement(lookup: ElementLookup, signal?: AbortSignal): Promise<Element>;
    /**
     * [12.3.5 Find Elements From Element](https://www.w3.org/TR/webdriver2/#find-elements-from-element)
     */
    findElements(lookup: ElementLookup, signal?: AbortSignal): Promise<Element[]>;
    /**
     * [12.3.9 Get Element Shadow Root](https://www.w3.org/TR/webdriver2/#get-element-shadow-root)
     */
    shadowRoot(signal?: AbortSignal): Promise<ShadowRoot>;
    /**
     * [12.4.1 Is Element Selected](https://www.w3.org/TR/webdriver2/#is-element-selected)
     */
    isSelected(signal?: AbortSignal): Promise<boolean>;
    /**
     * [12.4.2 Get Element Attribute](https://www.w3.org/TR/webdriver2/#get-element-attribute)
     */
    getAttribute(name: string, signal?: AbortSignal): Promise<null | string>;
    /**
     * [12.4.3 Get Element Property](https://www.w3.org/TR/webdriver2/#get-element-property)
     */
    getProperty(name: string, signal?: AbortSignal): Promise<unknown>;
    /**
     * [12.4.4 Get Element CSS Value](https://www.w3.org/TR/webdriver2/#get-element-css-value)
     */
    getCSSValue(name: string, signal?: AbortSignal): Promise<string>;
    /**
     * [12.4.5 Get Element Text](https://www.w3.org/TR/webdriver2/#get-element-text)
     */
    getText(signal?: AbortSignal): Promise<string>;
    /**
     * [12.4.6 Get Element Tag Name](https://www.w3.org/TR/webdriver2/#get-element-tag-name)
     */
    getTagName(signal?: AbortSignal): Promise<string>;
    /**
     * The Get Element Rect command returns the dimensions and coordinates of the given web element.
     */
    getRect(signal?: AbortSignal): Promise<ElementRect>;
    /**
     * [12.4.8 Is Element Enabled](https://www.w3.org/TR/webdriver2/#is-element-enabled)
     */
    isEnabled(signal?: AbortSignal): Promise<boolean>;
    /**
     * [12.4.9 Get Computed Role](https://www.w3.org/TR/webdriver2/#get-computed-role)
     */
    getComputedRole(signal?: AbortSignal): Promise<string>;
    /**
     * [12.4.10 Get Computed Label](https://www.w3.org/TR/webdriver2/#get-computed-label)
     */
    getComputedLabel(signal?: AbortSignal): Promise<string>;
    /**
     * [12.5.1 Element Click](https://www.w3.org/TR/webdriver2/#element-click)
     */
    click(signal?: AbortSignal): Promise<void>;
    /**
     * [12.5.2 Element Clear](https://www.w3.org/TR/webdriver2/#element-clear)
     */
    clear(signal?: AbortSignal): Promise<void>;
    /**
     * [12.5.3 Element Send Keys](https://www.w3.org/TR/webdriver2/#element-send-keys)
     */
    sendKeys(text: string, signal?: AbortSignal): Promise<void>;
    /**
     * [17.2 Take Element Screenshot](https://www.w3.org/TR/webdriver2/#take-element-screenshot)
     */
    takeScreenshot(signal?: AbortSignal): Promise<Base64PNG>;
    protected request<Args, Result>(method: Method, uri: string, args?: Args, signal?: AbortSignal): Promise<Result>;
}
export declare class ShadowRoot implements ShadowRootReference {
    private readonly session;
    private readonly shadowId;
    constructor(session: Session, shadowId: ShadowRootId);
    get [shadowRootIdentifier](): string;
    get sessionId(): string;
    /**
     * [12.3.6 Find Element From Shadow Root](https://www.w3.org/TR/webdriver2/#find-element-from-shadow-root)
     */
    findElement(lookup: ElementLookup, signal?: AbortSignal): Promise<Element>;
    /**
     * [12.3.7 Find Elements From Shadow Root](https://www.w3.org/TR/webdriver2/#find-elements-from-shadow-root)
     */
    findElements(lookup: ElementLookup, signal?: AbortSignal): Promise<Element[]>;
    protected request<Args, Result>(method: Method, uri: string, args?: Args, signal?: AbortSignal): Promise<Result>;
}
export {};
