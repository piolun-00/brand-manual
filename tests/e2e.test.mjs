// Testy całościowe edytora i eksportu (Playwright + wbudowany runner Node).
// Uruchomienie: cd tests && npm install && npm test   (albo: node --test tests/)
// Każdy test zaczyna od czystej przeglądarki (nowy kontekst = pusta IndexedDB).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { FIX, OUT, JSZip, browser, editor, openGroup, setPassword, exportManual, chapter, addBlock, loadProject } from "./helpers.mjs";
const require = createRequire(import.meta.url);

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
  await p.waitForTimeout(600); await p.click('.panel .card__title:has-text("Animacja Lottie")');
  assert.match(await p.locator('.panel .card:has-text("Animacja Lottie") .card__sub').innerText(), /1 animacja/);
  assert.deepEqual(p.errors, []);
  await p.context().close();
});

test("typografia: krój bez adresu — bez martwego linku, zostaje nazwa i autor", async () => {
  const p = await editor("single");
  await loadProject(p, { edit: (d) => {
    for (const c of d.chapters) for (const s of c.sections) for (const b of s.blocks) if (b.type === "typeface") {
      b.foundry = "Jan Autor"; b.license = { ...(b.license || {}), kind: "note", href: "" };
    }
  } });
  const { dir } = await exportManual(p, "kroj-bez-linku");
  const html = fs.readdirSync(dir, { recursive: true }).filter((f) => f.endsWith(".html")).map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
  assert.match(html, /class="typeface /, "blok Typografia jest w eksporcie");
  assert.doesNotMatch(html, /typeface__link/, "bez adresu nie ma linku (ani href=\"#\")");
  assert.match(html, /typeface__name[^>]*>[^<]*<br>Jan Autor/, "autor widoczny pod nazwą kroju");
  assert.deepEqual(p.errors, []);
  await p.context().close();
});
