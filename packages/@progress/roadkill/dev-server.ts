import { Server, ServerOptions } from "./server.js";

export interface AngularDevServerOptions {
}

/**
 * This server wraps calling `npm start` in an angular application,
 * created using `ng new`.
 */
export class AngularDevServer extends Server<AngularDevServerOptions> {
    public get prefix() { return this.options?.logPrefix ?? "Angular npm start" }
    protected override onLine(line: string) {
        if (this.state == "starting") {
            // ** Angular Live Development Server is listening on localhost:4200, open your browser on http://localhost:4200/ **
        }
    }
}

export interface ReactDevServerOptions {
}

/**
 * This server creates calling `npm start` in an React application,
 * created using `npx create-react-app`
 */
export class ReactDevServer extends Server<ReactDevServerOptions> {
    public get defaultPrefix() { return "React npm start" }
}

export interface VueDevServerOptions {
}

/**
 * This server wraps calling `npm run dev` in a vue vite application,
 * created using `npm create vue@latest`.
 */
export class VueDevServer extends Server<VueDevServerOptions> {
    public get defaultPrefix() { return "Vue npm run dev"}
}
