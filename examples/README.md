The new-app-* are:
 - new-app-react: `npx create-react-app new-app-react`
 - new-app-angular: `ng new --routing --style css new-app-angular`
 - new-vue-app: `npm create vue@latest`

## Starting dev server for new-app-*:
# new-app-angular
```
export NO_COLOR=1 && export BROWSER=none && npm start | cat

> new-app-angular@0.0.0 start
> ng serve

- Generating browser application bundles (phase: setup)...
✔ Browser application bundle generation complete.

Initial Chunk Files   | Names         |  Raw Size
vendor.js             | vendor        |   2.35 MB |
polyfills.js          | polyfills     | 333.18 kB |
styles.css, styles.js | styles        | 230.46 kB |
main.js               | main          |  48.75 kB |
runtime.js            | runtime       |   6.53 kB |

| Initial Total |   2.95 MB

Build at: 2023-10-10T05:56:40.769Z - Hash: 3a58e98a53caee3b - Time: 2833ms

** Angular Live Development Server is listening on localhost:4200, open your browser on http://localhost:4200/ **


✔ Compiled successfully.
```
# new-app-react
```
export NO_COLOR=1 && export BROWSER=none && npm start | cat

> new-app-react@0.1.0 start
> react-scripts start

(node:20098) [DEP_WEBPACK_DEV_SERVER_ON_AFTER_SETUP_MIDDLEWARE] DeprecationWarning: 'onAfterSetupMiddleware' option is deprecated. Please use the 'setupMiddlewares' option.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:20098) [DEP_WEBPACK_DEV_SERVER_ON_BEFORE_SETUP_MIDDLEWARE] DeprecationWarning: 'onBeforeSetupMiddleware' option is deprecated. Please use the 'setupMiddlewares' option.
Starting the development server...

Compiled successfully!

You can now view new-app-react in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.1.10:3000

Note that the development build is not optimized.
To create a production build, use npm run build.

webpack compiled successfully
```

# new-app-vue
```
export NO_COLOR=1 && export BROWSER=none && npm run dev | cat

> new-app-vue@0.0.0 dev
> vite


  VITE v4.4.11  ready in 2879 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h to show help
```