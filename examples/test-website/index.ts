// index.ts
//
// Localhost-only demo site for Roadkill WebDriver QA.
// - Guards all routes to localhost
// - Login page with GDPR overlay in an <iframe>
// - Consent sets a cookie and enables the form
// - Credentials: admin / 1234
// - Simulated auth delay (500–1500ms), then redirect to /toc
//
// Run:
//   npm install
//   npm start
//
// Open: http://localhost:3000/

import express, { type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";

const app = express();
app.set("trust proxy", false);
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

// ---- Localhost guard ---------------------------------------------------------
const LOOPBACKS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"]);
function isLocal(req: Request) {
  const ip = (req.ip || "").replace(/^::ffff:/, "");
  const host = (req.headers.host || "").split(":")[0];
  return LOOPBACKS.has(ip) || LOOPBACKS.has(host);
}
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!isLocal(req)) return res.status(403).send("Forbidden: localhost only.");
  next();
});

// ---- HTML helper -------------------------------------------------------------
function html(title: string, body: string, extraHead = "") {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; connect-src 'self'; img-src 'self' data:;
           style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline';
           frame-ancestors 'self';">
<style>
  :root { --bg:#ffffff; --card:#f8f9fa; --text:#1c1c1c; --muted:#555;
          --accent:#007bff; --accent2:#28a745; --border:#dcdcdc; }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; background:var(--bg); color:var(--text);
               font:14px/1.45 system-ui, Segoe UI, Roboto, Arial, sans-serif; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .container { max-width: 920px; margin: 48px auto; padding: 0 16px; }
  .card { background: var(--card); border:1px solid var(--border); border-radius: 14px;
          padding: 20px; box-shadow: 0 3px 12px rgba(0,0,0,0.08); }
  h1,h2,h3 { margin: 0 0 12px; }
  .muted { color: var(--muted); }
  .row { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px,1fr)); gap: 16px; }
  .btn { appearance:none; border:0; border-radius:10px; padding:10px 14px;
         background:var(--accent); color:#fff; font-weight:600; cursor:pointer; }
  .btn.secondary { background:#e2e6ea; color:var(--text); }
  .input { width:100%; padding:10px 12px; background:#fff; color:var(--text);
           border:1px solid #ccc; border-radius:8px; outline:none; }
  .input:focus { border-color: var(--accent2); box-shadow: 0 0 0 3px rgba(40,167,69,0.15); }
  .stack { display:grid; gap:10px; }
  .spacer { height:12px; }
  .center { text-align:center; }

  /* GDPR overlay */
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4);
             display:flex; align-items:center; justify-content:center;
             z-index:9999; backdrop-filter: blur(2px); }
  .overlay.hidden { display:none; }
  .overlay-frame { width: min(680px, 92vw); height: 380px; border: 1px solid var(--border);
                   border-radius:16px; overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,0.3); }

  /* Disable interactions behind overlay */
  .content.inert { pointer-events:none; user-select:none; opacity:0.6; }

  .error { color: #c62828; font-size: 13px; margin-top: 10px; }
</style>
${extraHead}
</head>
<body>
${body}
</body>
</html>`;
}

function getCookie(req: Request, name: string) {
  const v = (req.cookies && req.cookies[name]) as string | undefined;
  return typeof v === "string" ? v : undefined;
}

// ---- Routes ------------------------------------------------------------------

// Login + overlay
app.get("/", (req: Request, res: Response) => {
  const gdprAccepted = getCookie(req, "gdprAccepted") === "true";
  const body = `
<main class="page-login">
  <div class="container">
    <div class="card content ${gdprAccepted ? "" : "inert"}">
      <h1>Roadkill – Test Login</h1>
      <p class="muted">Localhost-only demo for WebDriver QA. Use <strong>admin / 1234</strong>.</p>
      <div class="spacer"></div>

      <form class="stack" id="login-form">
        <label>Username</label>
        <input id="username" class="input" name="username" autocomplete="username" placeholder="admin" value="admin">
        <label>Password</label>
        <input id="password" class="input" name="password" type="password" autocomplete="current-password" placeholder="1234" value="1234">
        <div class="hint muted">Submitting simulates a short random delay (500–1500ms) then navigates to Topics.</div>
        <div class="spacer"></div>
        <button class="btn" type="submit">Sign in</button>
      </form>
    </div>
  </div>

  <div id="overlay" class="overlay ${gdprAccepted ? "hidden" : ""}">
    <!-- IMPORTANT: allow-same-origin so CSP 'self' works inside iframe -->
    <iframe class="overlay-frame" title="GDPR" src="/gdpr"
            sandbox="allow-scripts allow-forms allow-same-origin"></iframe>
  </div>
</main>

<script>
(function(){
  const overlay = document.getElementById("overlay");
  const content = document.querySelector(".content");

  // Close overlay when GDPR accepted
  window.addEventListener("message", function(ev){
    if (ev && ev.data === "GDPR_ACCEPTED") {
      overlay.classList.add("hidden");
      content.classList.remove("inert");
    }
  });

  // Login flow
  const form = document.getElementById("login-form");
  form && form.addEventListener("submit", async function(e){
    e.preventDefault();
    const fd = new FormData(form);
    const username = String(fd.get("username") || "");
    const password = String(fd.get("password") || "");
    const r = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    if (r.ok) {
      const data = await r.json();
      const delay = data.delayMs ?? 500;
      const btn = form.querySelector("button");
      if (btn) { btn.setAttribute("disabled","true"); btn.textContent = "Signing in… (" + delay + " ms)"; }
      setTimeout(() => { window.location.href = "/toc"; }, delay);
    } else {
      // keep a simple message here for brevity
      alert("Invalid credentials. Try admin / 1234");
    }
  }, false);
})();
</script>
`;
  res.type("html").send(html("Roadkill – Login", body));
});

// GDPR iframe content (light UI, inline errors)
app.get("/gdpr", (_req: Request, res: Response) => {
  const body = `
<main class="page-gdpr">
  <div class="container">
    <div class="card">
      <h2>GDPR Consent</h2>
      <p class="muted">
        This demo stores a single cookie <code>gdprAccepted</code> to enable the login form.
        No other data is collected.
      </p>
      <div class="spacer"></div>
      <div class="stack">
        <button class="btn" id="accept">Accept</button>
        <button class="btn secondary" id="decline">Decline</button>
        <p class="error" id="error"></p>
      </div>
    </div>
  </div>
</main>
<script>
  const accept = document.getElementById("accept");
  const decline = document.getElementById("decline");
  const errorBox = document.getElementById("error");

  accept && accept.addEventListener("click", async () => {
    errorBox.textContent = "";
    try {
      const r = await fetch("/accept-gdpr", { method: "POST" });
      if (r.ok) {
        parent.postMessage("GDPR_ACCEPTED", "*");
      } else {
        errorBox.textContent = "Failed to record consent.";
      }
    } catch {
      errorBox.textContent = "Network error while recording consent.";
    }
  });

  decline && decline.addEventListener("click", () => {
    errorBox.textContent = "Consent is required to proceed.";
  });
</script>
`;
  res.type("html").send(html("GDPR Consent", body));
});

// Accept GDPR -> set cookie
app.post("/accept-gdpr", (_req: Request, res: Response) => {
  res.cookie("gdprAccepted", "true", {
    httpOnly: false,
    sameSite: "strict",
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  });
  res.json({ ok: true });
});

// Login endpoint – verify credentials, return randomized delay
app.post("/login", (req: Request, res: Response) => {
  const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
  if (username === "admin" && password === "1234") {
    const delayMs = Math.floor(500 + Math.random() * 1000); // 500–1500
    return res.json({ ok: true, delayMs });
  }
  return res.status(401).json({ ok: false, error: "Invalid credentials" });
});

// Topics page (cards)
app.get("/toc", (_req: Request, res: Response) => {
  const topics = [
    { title: "ChromeDriver", desc: "Standalone server implementing the WebDriver protocol for Chromium browsers. Roadkill manages lifecycle, logs, and startup detection.", href: "https://chromedriver.chromium.org/" },
    { title: "WebDriver", desc: "The W3C-standard browser automation protocol. Roadkill stays close to spec with typed commands and helpful errors.", href: "https://www.w3.org/TR/webdriver2/" },
    { title: "Semantic Objects", desc: "Higher-level DOM discovery helpers that make selectors readable, robust, and LLM-friendly.", href: "#semantic-objects" },
    { title: "Roadkill CLI", desc: "Checks Chrome/Node/ChromeDriver versions, manages drivers, and streamlines CI/dev workflows.", href: "#roadkill-cli" },
    { title: "MCP Integration", desc: "Expose Roadkill via the Model Context Protocol so LLMs can inspect pages and iteratively author tests.", href: "https://modelcontextprotocol.io/" }
  ];

  const cards = topics.map(t => `
    <div class="card">
      <h3>${t.title}</h3>
      <p class="muted">${t.desc}</p>
      <p><a href="${t.href}" target="_blank" rel="noopener">Learn more</a></p>
    </div>
  `).join("");

  const body = `
<main class="page-topics">
  <div class="container">
    <div class="card">
      <h1>Roadkill – Topics</h1>
      <p class="muted">Targetable summary cards for QA flows.</p>
    </div>
    <div class="spacer"></div>
    <div id="topics-grid" class="row">${cards}</div>
    <div class="spacer"></div>
    <p class="center"><a href="/">⬅ Back to Login</a></p>
  </div>
</main>
`;
  res.type("html").send(html("Roadkill – Topics", body));
});

// Health check
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// ---- Boot --------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`Test site running at http://localhost:${port}`);
  });
}

export default app;
