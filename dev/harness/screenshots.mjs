// Capture README screenshots from the harness with headless Edge/Chrome over the DevTools protocol.
// Usage: python dev/harness/serve.py   (in another terminal), then:
//        node dev/harness/screenshots.mjs
// Waits real time (not virtual time) so the plugin's timers settle exactly as in a normal browser.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "..", "screenshots");
const SCENES = ["home", "call-list", "pending", "messages", "menu"];
const BROWSERS = [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium"
];
const browser = BROWSERS.find(existsSync);
if (!browser) throw new Error("No Edge/Chrome found");

const port = 9333;
const proc = spawn(browser, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "dp-shots-"))}`, "about:blank"
], { stdio: "ignore" });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === "page"); } catch { }
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener("message", e => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
});
const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });

await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
mkdirSync(out, { recursive: true });
for (const scene of SCENES) {
    await send("Page.navigate", { url: `http://127.0.0.1:8766/channels/@me?scene=${scene}` });
    await sleep(4000);
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(out, `${scene}.png`), Buffer.from(data, "base64"));
    console.log("saved", scene);
}
ws.close();
proc.kill();
