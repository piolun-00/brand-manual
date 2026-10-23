// Testy całościowe edytora i eksportu (Playwright + wbudowany runner Node).
// Uruchomienie: cd tests && npm install && npm test   (albo: node --test tests/)
// Każdy test zaczyna od czystej przeglądarki (nowy kontekst = pusta IndexedDB).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIX = path.join(ROOT, "tests/fixtures");
const require = createRequire(import.meta.url);
const JSZip = require(path.join(ROOT, "vendor/jszip.min.js"));
// Playwright z node_modules testów albo z globalnej instalacji (środowisko Claude)
const { chromium } = await import("playwright").catch(() => import(process.env.PLAYWRIGHT_MODULE || "/opt/node-tools/node_modules/playwright/index.mjs"));

const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "kh-e2e-"));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".glb": "model/gltf-binary", ".zip": "application/zip" };
let server, base, browser;

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
async function editor(kind = "single") {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1600, height: 1000 } });
  const p = await ctx.newPage();
  p.errors = []; p.on("pageerror", (e) => p.errors.push(e.message));
  p.on("dialog", (d) => d.accept());
  await p.goto(base + "/"); await p.waitForSelector(".top__project");
  await p.click(".top__project > button"); await p.click(`text=+ Nowy ${kind} site`); await p.waitForTimeout(800);
  return p;
}
const openGroup = async (p, title, field) => { if (!(await p.isVisible(field))) await p.click(`.group__head:has-text("${title}")`); };
async function setPassword(p, pw) {
  await p.click('.nav button:has-text("Wydanie")');
  const f = '.f:has-text("Hasło do manuala") input';
  await openGroup(p, "Dostęp", f); await p.fill(f, pw); await p.waitForTimeout(300);
}
// Eksport z przejściem przez listę kontrolną; zwraca { zip, dir, url } rozpakowanego manuala
async function exportManual(p, name) {
  await p.click('button:has-text("Eksport ZIP")');
  const go = p.locator('button:has-text("Eksportuj mimo to")');
  const dl = p.waitForEvent("download", { timeout: 90000 });
  await Promise.race([go.waitFor({ timeout: 5000 }).then(() => go.click()).catch(() => {}), dl]);
  const file = path.join(OUT, name + ".zip"); await (await dl).saveAs(file);
  const zip = await JSZip.loadAsync(fs.readFileSync(file)), dir = path.join(OUT, name);
  for (const [n, e] of Object.entries(zip.files)) { const t = path.join(dir, n); if (e.dir) continue; fs.mkdirSync(path.dirname(t), { recursive: true }); fs.writeFileSync(t, await e.async("nodebuffer")); }
  return { zip, dir, url: `${base}/__out/${name}/` };
}
async function chapter(p, title) { await p.click(`.nav li > button:has-text("${title}")`); await p.waitForTimeout(300); }
async function addBlock(p, type) { await p.selectOption(".panel select.add", type); await p.waitForTimeout(400); }

// ——— testy ———
test("edytor startuje bez błędów, podgląd się renderuje", async () => {
  const p = await editor("multi");
  const fr = p.frames().find((f) => f !== p.mainFrame());
  await fr.waitForSelector(".sidebar");
  assert.ok(await fr.$("main#tresc"), "podgląd ma <main>");
  assert.deepEqual(p.errors, []);
  await p.context().close();
});

test("lista kontrolna przed eksportem i komplet plików w ZIP", async () => {
  const p = await editor("single");
  await p.click('button:has-text("Eksport ZIP")');
  await p.waitForSelector(".precheck");
  const items = await p.locator(".precheck__list li").allInnerTexts();
  assert.ok(items.some((t) => t.includes("Brak adresu manuala")));
  assert.ok(items.some((t) => /pust/.test(t)), "zgłasza puste miejsca");
  await p.click('.precheck button:has-text("Wróć")');
  assert.equal(await p.locator(".precheck").count(), 0);
  const { zip, dir } = await exportManual(p, "komplet");
  for (const f of ["index.html", "assets/style.css", "LICENSE.txt", "THIRD-PARTY-NOTICES.txt", "robots.txt"]) assert.ok(zip.files[f], `w ZIP jest ${f}`);
  const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  assert.match(html, /<html[^>]+data-build="KHOREI-BM-\d{4}-[0-9A-F]{16}"/);
  assert.match(html, /<main /); assert.match(html, /<h1/);
  assert.doesNotMatch(html, /__placeholder[^>]*>[^<]+</, "zaślepki w eksporcie bez tekstu");
  await p.context().close();
});

test("backup .khorei nie zawiera hasła", async () => {
  const p = await editor("single");
  await setPassword(p, "tajne123");
  assert.equal(await p.locator("text=Hasła nie zapisujemy").count(), 1);
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click('button:has-text("Backup na dysk")')]);
  const f = path.join(OUT, "b.khorei"); await dl.saveAs(f);
  const json = JSON.parse(await (await JSZip.loadAsync(fs.readFileSync(f))).file("project.json").async("string"));
  assert.equal(json.data.brand.password, "");
  await p.context().close();
});

test("hasło: treść zaszyfrowana, po wpisaniu hasła manual działa", async () => {
  const p = await editor("multi");
  await setPassword(p, "tajne123");
  const { dir, url } = await exportManual(p, "haslo");
  const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  assert.doesNotMatch(html, /sidebar__item/, "spis treści nie jest jawny");
  const v = await (await browser.newContext()).newPage();
  await v.goto(url); await v.fill("#kh-pw", "zle"); await v.click("#kh-form button"); await v.waitForTimeout(1200);
  assert.ok((await v.textContent("#kh-err")).trim().length > 0, "komunikat o złym haśle");
  await v.fill("#kh-pw", "tajne123"); await v.click("#kh-form button");
  await v.waitForSelector(".sidebar", { timeout: 10000 });
  // nawigacja bez przeładowania
  await v.evaluate(() => { window.__spa = 1; });
  await v.click(".sidebar__item >> nth=2"); await v.waitForTimeout(1000);
  assert.equal(await v.evaluate(() => window.__spa), 1, "przejście bez przeładowania");
  assert.ok(await v.$(".sidebar__item.is--active"));
  await v.context().close(); await p.context().close();
});

test("kotwice w single site nie zacinają się po pierwszym kliknięciu", async () => {
  const p = await editor("single");
  const { url } = await exportManual(p, "kotwice");
  // bez płynnego przewijania — sprawdzamy cel, nie animację
  const v = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" })).newPage();
  await v.goto(url); await v.waitForSelector(".sidebar");
  for (const n of [3, 6, 1]) {
    const href = await v.getAttribute(`.sidebar__item >> nth=${n}`, "href");
    await v.click(`.sidebar__item >> nth=${n}`); await v.waitForTimeout(600);
    assert.ok(v.url().endsWith(href), `adres ma ${href}`);
    const top = await v.evaluate((id) => document.getElementById(id).getBoundingClientRect().top, href.slice(1));
    const atEnd = await v.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2);
    assert.ok(Math.abs(top) < 80 || atEnd, `sekcja ${href} u góry ekranu (top=${top})`);
  }
  await v.context().close(); await p.context().close();
});

test("Lottie: nazwa z pliku, animacja działa z dysku (file://), biblioteki ładowane leniwie", async () => {
  const p = await editor("single");
  await chapter(p, "Animacje"); await addBlock(p, "lottie");
  await (await p.$('.panel input[type=file][multiple][accept*="json"]')).setInputFiles(path.join(FIX, "obrot.json"));
  await p.waitForTimeout(800);
  const names = await p.$$eval(".panel input", (a) => a.map((i) => i.value));
  assert.ok(names.includes("obrot"), "nazwa przeniesiona z pliku bez rozszerzenia");
  const { dir, url } = await exportManual(p, "lottie");
  const v = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const libs = []; v.on("request", (r) => { if (/lottie\.min|model-viewer/.test(r.url())) libs.push(r.url()); });
  await v.goto(url, { waitUntil: "networkidle" });
  assert.equal(libs.length, 0, "biblioteki nie ładują się na starcie");
  await v.evaluate(() => document.querySelector(".lottie").scrollIntoView()); await v.waitForTimeout(1500);
  assert.ok(libs.some((u) => /lottie/.test(u)), "Lottie ładuje się po dojściu do bloku");
  // z dysku
  await v.goto(pathToFileURL(path.join(dir, "index.html")).href);
  await v.evaluate(() => document.querySelector(".lottie").scrollIntoView()); await v.waitForTimeout(1500);
  assert.ok(await v.$$eval("[data-lottie] svg", (a) => a.length) > 0, "Lottie rysuje się z file://");
  await v.context().close(); await p.context().close();
});

test("Model 3D: OBJ konwertuje się do GLB", async () => {
  const p = await editor("single");
  await chapter(p, "Animacje"); await addBlock(p, "model");
  await (await p.$('.panel input[type=file][accept*=".glb"]')).setInputFiles(path.join(FIX, "szescian.obj"));
  await p.waitForSelector('.panel .file__name[title$=".glb"]', { timeout: 15000 });
  const { zip } = await exportManual(p, "model");
  assert.ok(Object.keys(zip.files).some((f) => f.endsWith(".glb")), "GLB w eksporcie");
  assert.ok(zip.files["assets/model-viewer.min.js"], "odtwarzacz 3D dołączony, bo jest użyty");
  assert.deepEqual(p.errors, []);
  await p.context().close();
});

test("sprzątanie nieużywanych plików", async () => {
  const p = await editor("single");
  await p.click('.nav > button:has-text("Marka")');
  const f = '.f:has-text("Plik logo") input[type=file]';
  await openGroup(p, "Logo i oprawa", f);
  await (await p.$(f)).setInputFiles(path.join(FIX, "logo-test.svg")); await p.waitForTimeout(500);
  await (await p.$(f)).setInputFiles(path.join(FIX, "ikona-kolo.svg")); await p.waitForTimeout(500);
  await p.click(".top__project > button");
  const btn = p.locator('.menu button:has-text("Wyczyść nieużywane")');
  assert.equal(await btn.count(), 1); await btn.click(); await p.waitForTimeout(600);
  await p.click(".top__project > button");
  assert.equal(await p.locator('.menu button:has-text("Wyczyść nieużywane")').count(), 0);
  await p.context().close();
});

test("dostępność eksportu (axe, jeśli zainstalowany)", { skip: !(() => { try { return require.resolve("axe-core"); } catch { return false; } })() }, async () => {
  const p = await editor("single");
  const { url } = await exportManual(p, "axe");
  const v = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await v.goto(url, { waitUntil: "networkidle" });
  await v.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const bad = await v.evaluate(async () => (await axe.run({ exclude: [[".contrast__sample"]] }, { resultTypes: ["violations"] })).violations.filter((x) => ["serious", "critical"].includes(x.impact)).map((x) => x.id + ": " + x.nodes.slice(0, 4).map((n) => n.target.join(" ") + " " + (n.any[0]?.message || "")).join(" || ")));
  assert.deepEqual(bad, []);
  await v.context().close(); await p.context().close();
});

test("rozdział: zwinięte karty pokazują podsumowanie i puste pola", async () => {
  const p = await editor("single");
  await chapter(p, "Ikony");
  assert.match(await p.locator(".panel .card__warn").first().innerText(), /\d+ pust/);
  await chapter(p, "Animacje"); await addBlock(p, "lottie");
  await (await p.$('.panel input[type=file][multiple][accept*="json"]')).setInputFiles(path.join(FIX, "obrot.json"));
  await p.waitForTimeout(600); await p.click('.panel .card__title:has-text("Animacje Lottie")');
  assert.match(await p.locator('.panel .card:has-text("Animacje Lottie") .card__sub').innerText(), /1 animacja/);
  assert.deepEqual(p.errors, []);
  await p.context().close();
});
