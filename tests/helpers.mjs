// Wspólne narzędzia testów: serwer statyczny, przeglądarka, edytor, eksport, gotowe projekty.
import { before, after } from "node:test";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FIX = path.join(ROOT, "tests/fixtures");
const require = createRequire(import.meta.url);
export const JSZip = require(path.join(ROOT, "vendor/jszip.min.js"));
// Playwright z node_modules testów albo z globalnej instalacji (środowisko Claude)
const { chromium } = await import("playwright").catch(() => import(process.env.PLAYWRIGHT_MODULE || "/opt/node-tools/node_modules/playwright/index.mjs"));

export const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "kh-e2e-"));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".glb": "model/gltf-binary", ".zip": "application/zip" };
let server;
export let base, browser;

before(async () => {
  // Serwer statyczny: edytor z katalogu repo, rozpakowane eksporty pod /__out/
  server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const dir = p.startsWith("/__out/") ? OUT : ROOT;
    if (p.startsWith("/__out/")) p = p.slice(6);
    let f = path.join(dir, p);
    if (!f.startsWith(dir)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
    if (!fs.existsSync(f)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
  browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
});
after(async () => { await browser?.close(); server?.close(); fs.rmSync(OUT, { recursive: true, force: true }); });

// ——— pomocnicze ———
export async function editor(kind = "single") {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1600, height: 1000 } });
  const p = await ctx.newPage();
  p.errors = []; p.on("pageerror", (e) => p.errors.push(e.message));
  p.on("dialog", (d) => d.accept());
  await p.goto(base + "/"); await p.waitForSelector(".top__project");
  await p.click(".top__project > button"); await p.click(`text=+ Nowy ${kind} site`); await p.waitForTimeout(800);
  return p;
}
export const openGroup = async (p, title, field) => { if (!(await p.isVisible(field))) await p.click(`.group__head:has-text("${title}")`); };
export async function setPassword(p, pw) {
  await p.click('.nav button:has-text("Wydanie")');
  const f = '.f:has-text("Hasło do manuala") input';
  await openGroup(p, "Dostęp", f); await p.fill(f, pw); await p.waitForTimeout(300);
}
// Eksport z przejściem przez listę kontrolną; zwraca { zip, dir, url } rozpakowanego manuala
export async function exportManual(p, name) {
  await p.click('button:has-text("Eksport ZIP")');
  const go = p.locator('button:has-text("Eksportuj mimo to")');
  const dl = p.waitForEvent("download", { timeout: 90000 });
  await Promise.race([go.waitFor({ timeout: 5000 }).then(() => go.click()).catch(() => {}), dl]);
  const file = path.join(OUT, name + ".zip"); await (await dl).saveAs(file);
  const zip = await JSZip.loadAsync(fs.readFileSync(file)), dir = path.join(OUT, name);
  for (const [n, e] of Object.entries(zip.files)) { const t = path.join(dir, n); if (e.dir) continue; fs.mkdirSync(path.dirname(t), { recursive: true }); fs.writeFileSync(t, await e.async("nodebuffer")); }
  return { zip, dir, url: `${base}/__out/${name}/` };
}
export async function chapter(p, title) { await p.click(`.nav li > button:has-text("${title}")`); await p.waitForTimeout(300); }
export async function addBlock(p, type) { await p.selectOption(".panel select.add", type); await p.waitForTimeout(400); }


// Gotowy projekt wczytywany jak backup .khorei: przykład (single / multi) + zmiany + pliki z fixtures.
// Dzięki temu test eksportu nie musi przeklikiwać formularzy — sprawdza silnik na znanych danych.
export async function loadProject(p, { kind = "single", edit = () => {}, assets = {} } = {}) {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, `engine/sample${kind === "single" ? "-single" : ""}.json`), "utf8"));
  edit(data);
  const zip = new JSZip();
  zip.file("project.json", JSON.stringify({ format: "khorei-brandmanual", version: 2, id: "test-" + Math.random().toString(36).slice(2, 8), data }));
  for (const [dst, src] of Object.entries(assets)) zip.file("assets/" + dst, fs.readFileSync(path.join(FIX, src)));
  const file = path.join(OUT, `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.khorei`);
  fs.writeFileSync(file, await zip.generateAsync({ type: "nodebuffer" }));
  await p.setInputFiles('label:has-text("Wczytaj backup") input[type=file]', file);
  await p.waitForTimeout(1200);
}
// Otwarta strona eksportu z licznikiem błędów i odpowiedzi 404
export async function viewer(url, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const v = await ctx.newPage();
  v.errors = []; v.missing = [];
  v.on("pageerror", (e) => v.errors.push(e.message));
  v.on("response", (r) => { if (r.status() >= 400) v.missing.push(r.url()); });
  if (url) await v.goto(url, { waitUntil: "networkidle" });
  return v;
}
