// Testy rozszerzone: eksport na znanych danych (projekt wczytany jak backup), bezpieczeństwo,
// responsywność, pliki prawne, układ przycisków bloków. Uruchomienie jak e2e.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ROOT, OUT, JSZip, base, browser, editor, openGroup, setPassword, exportManual, chapter, loadProject, viewer } from "./helpers.mjs";
const require = createRequire(import.meta.url);
const bcrypt = require(path.join(ROOT, "vendor/bcrypt.min.js"));

const walk = (data, fn) => { for (const c of data.chapters) for (const s of c.sections || []) for (const b of s.blocks || []) fn(b, s, c); };
const chapterOf = (data, title) => data.chapters.find((c) => c.title === title);
// Kontrast WCAG liczony w przeglądarce z kolorów wyliczonych przez CSS
const CONTRAST = `(fg, bg) => { const L = (c) => { const [r, g, b] = c.match(/\\d+(\\.\\d+)?/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }; const a = L(fg), b = L(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }`;

test("multi site: nawigacja, wstecz / dalej, wejście prosto na rozdział, brak 404", async () => {
  const p = await editor("multi");
  const { url } = await exportManual(p, "multi-nav");
  const v = await viewer(url);
  await v.evaluate(() => { window.__spa = 1; });
  const hrefs = await v.$$eval(".sidebar__item", (a) => a.map((x) => x.getAttribute("href")));
  await v.click(".sidebar__item >> nth=4"); await v.waitForTimeout(800);
  const u4 = v.url();
  await v.click(".sidebar__item >> nth=9"); await v.waitForTimeout(800);
  assert.equal(await v.evaluate(() => window.__spa), 1, "przejścia bez przeładowania");
  await v.goBack(); await v.waitForTimeout(800);
  assert.equal(v.url(), u4, "wstecz wraca do poprzedniego rozdziału");
  assert.match(await v.$eval(".sidebar__item.is--active", (a) => a.getAttribute("href")), new RegExp(hrefs[4].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"));
  await v.goForward(); await v.waitForTimeout(800);
  assert.match(await v.$eval("h1", (h) => h.textContent), /\S/);
  // wejście prosto na podstronę (link wysłany mailem)
  const d = await viewer(new URL(hrefs[6], url).href);
  assert.ok(await d.$(".sidebar"), "podstrona działa przy wejściu z zewnątrz");
  assert.ok(await d.$eval("link[rel=stylesheet]", (l) => [...l.sheet.cssRules].length > 10), "style wczytane z podstrony");
  assert.deepEqual([...v.missing, ...d.missing], [], "żadnych 404");
  assert.deepEqual([...v.errors, ...d.errors], []);
  await v.context().close(); await d.context().close(); await p.context().close();
});

test("hasło serwera (.htaccess): komplet plików i poprawny hash bcrypt", async () => {
  const p = await editor("single");
  await setPassword(p, "Marka2026!");
  await p.selectOption('.f:has-text("Sposób ochrony") select', "server");
  await p.fill('.f:has-text("Login") input', "klient"); await p.waitForTimeout(300);
  const { zip, dir } = await exportManual(p, "htaccess");
  for (const f of [".htaccess", ".htpasswd", "CZYTAJ-HASLO.txt"]) assert.ok(zip.files[f], `jest ${f}`);
  const [login, hash] = (await zip.file(".htpasswd").async("string")).trim().split(":");
  assert.equal(login, "klient"); assert.match(hash, /^\$2y\$/);
  assert.ok(bcrypt.compareSync("Marka2026!", hash.replace(/^\$2y\$/, "$2a$")), "hash pasuje do hasła");
  assert.ok(!bcrypt.compareSync("zle", hash.replace(/^\$2y\$/, "$2a$")));
  assert.match(await zip.file(".htaccess").async("string"), /AuthType Basic/);
  assert.match(fs.readFileSync(path.join(dir, "index.html"), "utf8"), /sidebar__item/, "przy haśle serwera strony nie są szyfrowane");
  await p.context().close();
});

test("bezpieczeństwo: znaczniki w nazwach i złośliwe SVG logo nic nie uruchamiają", async () => {
  const p = await editor("single");
  await loadProject(p, {
    edit: (d) => {
      d.brand.name = 'Marka <img src=x onerror="window.__xss=9">';
      d.brand.logo = "media/zle.svg"; d.brand.logoColor = "auto"; d.brand.sidebarColor = "c1";
      d.chapters[1].title = "Historia <script>window.__xss=8</script>";
    },
    assets: { "media/zle.svg": "zle.svg" }
  });
  const fr = p.frames().find((f) => f !== p.mainFrame());
  await p.waitForTimeout(800);
  assert.equal(await fr.evaluate(() => window.__xss), undefined, "podgląd w edytorze");
  const { url } = await exportManual(p, "xss");
  const v = await viewer(url);
  await v.click(".sidebar__item >> nth=1"); await v.waitForTimeout(500);
  assert.equal(await v.evaluate(() => window.__xss), undefined, "eksport");
  assert.match(await v.$eval("h1", (h) => h.textContent), /<img src=x/, "znaczniki widać jako tekst");
  const bad = await v.$eval(".sidebar__logo svg", (svg) => [...svg.querySelectorAll("*"), svg].flatMap((el) => [
    ...(/^(script|foreignObject|iframe|object)$/i.test(el.tagName) ? [el.tagName] : []),
    ...[...el.attributes].filter((a) => /^on/i.test(a.name) || /javascript:/i.test(a.value)).map((a) => `${el.tagName}[${a.name}]`)]));
  assert.deepEqual(bad, [], "SVG oczyszczone ze skryptów i zdarzeń");
  assert.match(await v.$eval(".sidebar__logo", (el) => el.innerHTML), /currentColor/, "logo przebarwione");
  assert.deepEqual(v.errors, []);
  await v.context().close(); await p.context().close();
});

test("pasek boczny: ciemny kolor marki — tekst, aktywna pozycja i logo czytelne (≥ 4.5:1)", async () => {
  for (const color of ["c1", "c2", "c3", "custom"]) {
    const p = await editor("single");
    await loadProject(p, { edit: (d) => { d.brand.sidebarColor = color; d.brand.sidebarHex = "#2B4CFF"; d.brand.logo = "media/logo.svg"; d.brand.logoColor = "auto"; }, assets: { "media/logo.svg": "logo-test.svg" } });
    const { url } = await exportManual(p, "pasek-" + color);
    const v = await viewer(url, { reducedMotion: "reduce" });
    await v.click(".sidebar__item >> nth=5"); await v.waitForTimeout(500);
    const r = await v.evaluate(`(() => { const c = ${CONTRAST}; const sb = getComputedStyle(document.querySelector(".sidebar")).backgroundColor;
      const items = [...document.querySelectorAll(".sidebar__item:not(.is--active) .sidebar__title")].map((e) => c(getComputedStyle(e).color, sb));
      const act = document.querySelector(".sidebar__item.is--active .sidebar__title");
      return { min: Math.min(...items), active: act ? c(getComputedStyle(act).color, sb) : 0, logo: c(getComputedStyle(document.querySelector(".sidebar__logo")).color, sb) }; })()`);
    assert.ok(r.min >= 4.5, `${color}: tekst paska ${r.min.toFixed(2)}`);
    assert.ok(r.active >= 4.5, `${color}: aktywna ${r.active.toFixed(2)}`);
    assert.ok(r.logo >= 3, `${color}: logo ${r.logo.toFixed(2)}`);
    await v.context().close(); await p.context().close();
  }
});

test("ikony: nazwy z pliku, ZIP z nazwanymi SVG, currentColor, pobieranie pojedyncze", async () => {
  const p = await editor("single");
  await loadProject(p, {
    edit: (d) => walk(d, (b) => { if (b.type === "icons") { b.currentColor = true; b.items = [{ name: "Koło", svg: "media/kolo.svg" }, { name: "Koło", svg: "media/kolo2.svg" }, { name: "Strzałka w prawo", svg: "media/s.svg" }]; } }),
    assets: { "media/kolo.svg": "ikona-kolo.svg", "media/kolo2.svg": "ikona-kolo.svg", "media/s.svg": "ikona-kolo.svg" }
  });
  const { zip, url } = await exportManual(p, "ikony");
  const zpath = Object.keys(zip.files).find((f) => /^files\/.*ikony.*\.zip$/.test(f));
  assert.ok(zpath, "ZIP ikon w files/");
  const inner = await JSZip.loadAsync(await zip.file(zpath).async("nodebuffer"));
  assert.deepEqual(Object.keys(inner.files).sort(), ["kolo-2.svg", "kolo.svg", "strzalka-w-prawo.svg"]);
  assert.match(await inner.file("kolo.svg").async("string"), /stroke="currentColor"/);
  const v = await viewer(url);
  const a = await v.$eval(".icon-tile__chip", (e) => [e.getAttribute("href"), e.getAttribute("download")]);
  assert.ok(a[0] && a[1] === "kolo.svg", "pojedyncze pobranie z nazwą");
  await v.context().close(); await p.context().close();
});

// MP4 w AV1: Chromium z Playwrighta nie ma kodeka H.264 (prawdziwy Chrome i Safari mają)
test("zdjęcia i okładka: wersja @1x dla telefonu, srcset, MP4 z klatką startową", async () => {
  const p = await editor("single");
  await loadProject(p, {
    edit: (d) => {
      d.brand.cover = "media/okladka.jpg";
      walk(d, (b) => { if (b.type === "images") b.items = b.items.map(() => ({ image: "media/foto.jpg", caption: "Podpis" })); if (b.type === "video") { b.source = "file"; b.file = "media/anim.mp4"; } });
    },
    assets: { "media/okladka.jpg": "zdjecie.jpg", "media/foto.jpg": "zdjecie.jpg", "media/anim.mp4": "animacja.mp4" }
  });
  const { zip, url } = await exportManual(p, "media");
  assert.ok(zip.files["media/foto@1x.jpg"], "zdjęcie @1x"); assert.ok(zip.files["media/okladka@1x.jpg"], "okładka @1x");
  assert.ok(zip.files["media/anim-poster.jpg"], "klatka startowa MP4");
  const v = await viewer(url);
  assert.match(await v.$eval(".gallery__item img", (i) => i.getAttribute("srcset") || ""), /@1x/);
  assert.equal(await v.$eval("video", (x) => x.getAttribute("poster")), "media/anim-poster.jpg");
  const m = await viewer(url, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  assert.match(await m.$eval(".cover__img", (i) => i.currentSrc), /@1x/, "telefon dostaje mniejszą okładkę");
  assert.deepEqual([...v.missing, ...m.missing], []);
  await v.context().close(); await m.context().close(); await p.context().close();
});

test("backup: zapis i wczytanie w czystej przeglądarce odtwarza projekt z plikami", async () => {
  const p = await editor("single");
  await p.click('.nav > button:has-text("Marka")');
  await p.fill('.f:has-text("Nazwa marki") input', "Backup Test"); await p.waitForTimeout(300);
  const f = '.f:has-text("Plik logo") input[type=file]';
  await openGroup(p, "Logo i oprawa", f); await p.setInputFiles(f, path.join(ROOT, "tests/fixtures/logo-test.svg")); await p.waitForTimeout(600);
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click('button:has-text("Backup na dysk")')]);
  const file = path.join(OUT, "rt.khorei"); await dl.saveAs(file);
  const q = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  q.on("dialog", (d) => d.accept());
  await q.goto(base + "/"); await q.waitForSelector(".top__project");
  await q.setInputFiles('label:has-text("Wczytaj backup") input[type=file]', file); await q.waitForTimeout(1500);
  assert.match(await q.$eval(".top__project > button", (b) => b.textContent), /Backup Test/);
  const fr = q.frames().find((x) => x !== q.mainFrame());
  assert.ok(await fr.$(".sidebar__logo img, .sidebar__logo svg"), "logo wróciło z backupu");
  await q.context().close(); await p.context().close();
});

test("cofnij / przywróć", async () => {
  const p = await editor("single");
  await p.click('.nav > button:has-text("Marka")');
  const f = '.f:has-text("Nazwa marki") input';
  const before = await p.inputValue(f);
  await p.fill(f, "Zmiana 1"); await p.waitForTimeout(900);
  await p.click('button[aria-label="Cofnij"]'); await p.waitForTimeout(300);
  assert.equal(await p.inputValue(f), before);
  await p.click('button[aria-label="Przywróć"]'); await p.waitForTimeout(300);
  assert.equal(await p.inputValue(f), "Zmiana 1");
  await p.context().close();
});

test("responsywność eksportu: bez poziomego przewijania, szuflada Indeks na telefonie", async () => {
  const p = await editor("single");
  await loadProject(p, { edit: (d) => { d.brand.name = "Bardzo długa nazwa marki, która musi się złamać"; walk(d, (b) => { if (b.type === "images") b.items = b.items.map(() => ({ image: "media/f.jpg", caption: "" })); }); }, assets: { "media/f.jpg": "zdjecie.jpg" } });
  const { url } = await exportManual(p, "resp");
  for (const w of [360, 390, 768, 1024, 1280, 1440, 1920, 2560]) {
    const v = await viewer(url, { viewport: { width: w, height: 900 } });
    const over = await v.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 0, `${w}px: poziome przewijanie o ${over}px`);
    if (w === 390) {
      await v.click("[data-drawer-open]"); await v.waitForTimeout(500);
      assert.ok(await v.evaluate(() => document.body.classList.contains("is--drawer-open")), "Indeks się otwiera");
      await v.click(".sidebar__item >> nth=5"); await v.waitForTimeout(700);
      assert.ok(!(await v.evaluate(() => document.body.classList.contains("is--drawer-open"))), "wybór zamyka szufladę");
      assert.ok(await v.evaluate(() => scrollY > 500), "i przewija do rozdziału");
    }
    await v.context().close();
  }
  await p.context().close();
});

test("pliki prawne: licencja z adresem i sygnaturą, noty tylko użytych bibliotek, robots", async () => {
  const p = await editor("single");
  await loadProject(p, { edit: (d) => { d.brand.siteUrl = "https://klient.pl/brandbook/"; d.brand.name = "Marka Test"; } });
  const { zip } = await exportManual(p, "legal");
  const html = await zip.file("index.html").async("string"), sig = html.match(/data-build="([^"]+)"/)[1];
  const lic = await zip.file("LICENSE.txt").async("string");
  assert.ok(lic.includes("https://klient.pl/brandbook/") && lic.includes("Marka Test") && lic.includes(sig));
  assert.ok((await zip.file("assets/style.css").async("string")).includes(sig), "sygnatura w CSS");
  const notes = await zip.file("THIRD-PARTY-NOTICES.txt").async("string");
  assert.match(notes, /Geist/); assert.doesNotMatch(notes, /three\.js|model-viewer/i, "bez 3D w manualu nie ma not 3D");
  assert.ok(!zip.files["assets/model-viewer.min.js"], "odtwarzacz 3D nie trafia do eksportu bez modelu");
  assert.match(await zip.file("robots.txt").async("string"), /GPTBot[\s\S]*Disallow: \//);
  assert.match(html, /tdm-reservation/);
  await p.context().close();
});

test("stopka i kopiowanie HEX", async () => {
  const p = await editor("single");
  const { url } = await exportManual(p, "stopka");
  const v = await viewer(url);
  await v.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(url).origin });
  const links = await v.$$eval(".footer a", (a) => a.map((x) => x.getAttribute("href")));
  assert.ok(links.includes("https://khorei.com")); assert.ok(links.some((h) => h.startsWith("mailto:")));
  await v.click(".swatch__copy >> nth=0"); await v.waitForTimeout(400);
  assert.match(await v.evaluate(() => navigator.clipboard.readText()), /^#[0-9A-F]{6}$/i);
  await v.context().close(); await p.context().close();
});

test("ABC Areal bez plików: ostrzeżenie przed eksportem i brak plików kroju w ZIP", async () => {
  const p = await editor("single");
  await loadProject(p, { edit: (d) => { d.brand.font = "areal"; } });
  await p.click('button:has-text("Eksport ZIP")'); await p.waitForSelector(".precheck");
  assert.ok((await p.locator(".precheck__list li").allInnerTexts()).some((t) => /Areal/.test(t)));
  await p.click('.precheck button:has-text("Wróć")');
  const { zip } = await exportManual(p, "areal");
  assert.ok(!Object.keys(zip.files).some((f) => /areal/i.test(f) && /\.(woff2?|otf|ttf)$/.test(f)));
  await p.context().close();
});

test("przycisk bloku: w belce opisu (rząd od 1280 px, pod tekstem poniżej), bez belki — w nagłówku sekcji", async () => {
  const p = await editor("single");
  await loadProject(p, {
    edit: (d) => {
      const ch = chapterOf(d, "Animacje");
      ch.sections[0].blocks = [
        { id: "lm", type: "lottie", line: true, label: "Animacje", text: "Opis", items: [{ name: "Obrót", file: "media/o.json" }] },
      ];
      const ic = chapterOf(d, "Ikony"); walk({ chapters: [ic] }, (b) => { b.line = false; b.label = ""; b.text = ""; b.items = [{ name: "Koło", svg: "media/k.svg" }]; });
    },
    assets: { "media/o.json": "obrot.json", "media/k.svg": "ikona-kolo.svg" }
  });
  const { url } = await exportManual(p, "akcje");
  for (const [w, row] of [[1280, true], [1279, false], [390, false]]) {
    const v = await viewer(url, { viewport: { width: w, height: 900 } });
    const r = await v.evaluate(() => { const body = document.querySelector(".lottie")?.closest(".block, section")?.querySelector(".block__meta-body") || document.querySelector(".block__meta-body"); const btn = document.querySelector(".block__meta-action"); if (!body || !btn) return null; const a = body.getBoundingClientRect(), b = btn.getBoundingClientRect(); return { beside: b.left >= a.right - 1, below: b.top >= a.bottom - 1 }; });
    assert.ok(r, `${w}: przycisk Lottie w belce`);
    assert.equal(r.beside, row, `${w}: obok tekstu = ${row}`); assert.equal(r.below, !row, `${w}: pod tekstem = ${!row}`);
    assert.ok(await v.$('.section-header__action a[href$=".zip"]'), `${w}: ZIP ikon w nagłówku sekcji`);
    await v.context().close();
  }
  await p.context().close();
});

test("wydajność: pierwsze wejście lekkie, eksport ze zdjęciami w rozsądnym czasie", async () => {
  const p = await editor("single");
  await loadProject(p, { edit: (d) => walk(d, (b) => { if (b.type === "images") b.items = b.items.map((_, i) => ({ image: `media/f${i}.jpg`, caption: "" })); }), assets: Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`media/f${i}.jpg`, "zdjecie.jpg"])) });
  const t0 = Date.now(); const { url } = await exportManual(p, "perf"); const secs = (Date.now() - t0) / 1000;
  assert.ok(secs < 60, `eksport ${secs}s`);
  const v = await browser.newContext({ viewport: { width: 1440, height: 900 } }).then((c) => c.newPage());
  let bytes = 0; v.on("response", async (r) => { if (!/\.(jpe?g|png|mp4|webp)$/.test(r.url())) try { bytes += (await r.body()).length; } catch {} });
  await v.goto(url, { waitUntil: "networkidle" });
  assert.ok(bytes < 400 * 1024, `kod + fonty na starcie: ${Math.round(bytes / 1024)} KB`);
  console.log(`# eksport ${secs.toFixed(1)} s, start bez zdjęć ${Math.round(bytes / 1024)} KB`);
  await v.context().close(); await p.context().close();
});

test("Marka: ciemny pasek bez akcentu nie wysypuje formularza (regresja)", async () => {
  const p = await editor("single");
  await p.click('.nav > button:has-text("Marka")');
  await openGroup(p, "Logo i oprawa", '.f:has-text("Kolor paska") select');
  await p.selectOption('.f:has-text("Kolor paska") select', { label: "Grafit — #1C1C1C" }); await p.waitForTimeout(500);
  assert.match(await p.locator(".panel").innerText(), /Tekst spisu: jasny/);
  assert.equal(await p.locator(".safe").count(), 0, "bez bezpiecznika");
  assert.deepEqual(p.errors, []);
  await p.context().close();
});

test("multi site: rozdziały o nazwach folderów eksportu dostają bezpieczny adres", async () => {
  const p = await editor("multi");
  await loadProject(p, { kind: "multi", edit: (d) => { d.chapters[0].title = "Assets"; d.chapters[0].slug = ""; d.chapters[1].title = "Media"; d.chapters[1].slug = ""; d.chapters[2].title = "Licenses"; d.chapters[2].slug = ""; } });
  const { zip, url } = await exportManual(p, "slugi");
  for (const f of ["assets-2/index.html", "media-2/index.html", "licenses-2/index.html", "assets/style.css"]) assert.ok(zip.files[f], f);
  const v = await viewer(url + "assets-2/");
  assert.ok(await v.$(".sidebar"), "podstrona działa"); assert.deepEqual(v.missing, []);
  await v.context().close(); await p.context().close();
});

test("okładka: jednolity kolor z palety i własny kolor tekstu, ostrzeżenie przy słabym kontraście", async () => {
  const p = await editor("single");
  await loadProject(p, { edit: (d) => { d.brand.coverMode = "color"; d.brand.coverColor = "c1"; d.brand.coverText = "c4"; d.brand.cover = "media/foto.jpg"; }, assets: { "media/foto.jpg": "zdjecie.jpg" } });
  const { url } = await exportManual(p, "okladka-kolor");
  const v = await viewer(url);
  const c = await v.$eval(".cover.is--start", (e) => [getComputedStyle(e).backgroundColor, getComputedStyle(e.querySelector("h1")).color, !!e.querySelector("img")]);
  assert.equal(c[0], "rgb(28, 28, 28)", "tło = Grafit"); assert.equal(c[1], "rgb(255, 255, 255)", "tekst = Biel"); assert.equal(c[2], false, "w trybie koloru bez zdjęcia");
  await v.context().close();
  // domyślnie: ciemnoszare pole pod zdjęcie i biały tekst
  const q = await editor("single");
  const { url: u2 } = await exportManual(q, "okladka-domyslna");
  const w = await viewer(u2);
  assert.deepEqual(await w.$eval(".cover.is--start", (e) => [getComputedStyle(e).backgroundColor, getComputedStyle(e.querySelector("h1")).color]), ["rgb(60, 60, 58)", "rgb(255, 255, 255)"], "domyślnie ciemnoszare tło i biały tekst");
  await w.context().close(); await q.context().close();
  // słaby kontrast → ostrzeżenie w Marce i na liście przed eksportem
  await loadProject(p, { edit: (d) => { d.brand.coverMode = "color"; d.brand.coverColor = "c2"; d.brand.coverText = "c3"; } });
  await p.click('button:has-text("Eksport ZIP")'); await p.waitForSelector(".precheck");
  assert.ok((await p.locator(".precheck__list li").allInnerTexts()).some((t) => /okładki słabo czytelny/.test(t)));
  await p.context().close();
});

test("wyszukiwarki: domyślnie noindex, po włączeniu index — robots.txt mówi to samo", async () => {
  for (const on of [false, true]) {
    const p = await editor("single");
    await p.click('.nav button:has-text("Wydanie")');
    const box = '.check:has-text("Widoczny w wyszukiwarkach") input';
    await openGroup(p, "Udostępnianie", box);
    if (on) await p.check(box);
    const { zip } = await exportManual(p, "seo-" + on);
    const html = await zip.file("index.html").async("string"), robots = await zip.file("robots.txt").async("string");
    assert.match(html, on ? /name="robots" content="index, follow, noai/ : /name="robots" content="noindex, noai/);
    assert.match(robots, on ? /jest widoczny w wynikach/ : /NIE jest widoczny w wynikach/);
    assert.match(robots, /GPTBot[\s\S]*Disallow: \//, "trenowanie AI zablokowane zawsze");
    await p.context().close();
  }
});

test("Lottie: ostrzeżenie o wyrażeniach i obrazkach spoza JSON, zwykły plik bez ostrzeżeń", async () => {
  const p = await editor("single");
  await chapter(p, "Animacje"); await p.selectOption(".panel select.add", "lottie"); await p.waitForTimeout(400);
  const multi = '.panel input[type=file][multiple][accept*="json"]';
  await p.setInputFiles(multi, path.join(ROOT, "tests/fixtures/obrot.json")); await p.waitForTimeout(500);
  assert.equal(await p.locator(".panel .f__warn").count(), 0, "zwykła animacja bez ostrzeżeń");
  await p.setInputFiles(multi, [path.join(ROOT, "tests/fixtures/lottie-wyrazenia.json"), path.join(ROOT, "tests/fixtures/lottie-obrazek.json")]); await p.waitForTimeout(800);
  const warn = await p.locator(".panel .f__warn").innerText();
  assert.match(warn, /lottie-wyrazenia\.json.*wyrażeń/s); assert.match(warn, /lottie-obrazek\.json.*osobnych plikach/s);
  await p.context().close();
});

test("okładka: nazwa marki łamie się dopiero po zajęciu połowy szerokości okładki", async () => {
  const p = await editor("single");
  await loadProject(p, { edit: (d) => { d.brand.name = "Bardzo długa nazwa marki, która musi się złamać w pół drogi"; } });
  const { url } = await exportManual(p, "okladka-50");
  for (const w of [1280, 1440, 1920, 2560]) {
    const v = await viewer(url, { viewport: { width: w, height: 900 } });
    const r = await v.$eval(".cover.is--start", (c) => { const head = c.querySelector(".cover__head").getBoundingClientRect(), b = c.querySelector(".cover__brand"), br = b.getBoundingClientRect(); return { share: br.width / head.width, lines: Math.round(br.height / parseFloat(getComputedStyle(b).lineHeight)) }; });
    assert.ok(r.share <= 0.51, `${w}: nazwa zajmuje ${(r.share * 100).toFixed(0)}%`);
    assert.ok(r.lines >= 2, `${w}: długa nazwa się łamie`);
    await v.context().close();
  }
  // krótka nazwa — jedna linia
  const q = await editor("single"); const { url: u2 } = await exportManual(q, "okladka-krotka");
  const k = await viewer(u2, { viewport: { width: 1280, height: 900 } });
  assert.equal(await k.$eval(".cover__brand", (b) => Math.round(b.getBoundingClientRect().height / parseFloat(getComputedStyle(b).lineHeight))), 1);
  await k.context().close(); await q.context().close(); await p.context().close();
});

test("demo kodu: wgranie plików, podgląd na żywo, zakładki, eksport z folderem demos/ i ZIP", async () => {
  const p = await editor("single");
  await chapter(p, "Animacje"); await p.selectOption(".panel select.add", "code"); await p.waitForTimeout(400);
  const F = (n) => path.join(ROOT, "tests/fixtures/demo", n);
  await p.setInputFiles('.panel input[type=file][data-code-files]', [F("index.html"), F("styles.css"), F("main.js")]); await p.waitForTimeout(800);
  const html = await p.inputValue('.panel .f:has-text("HTML") textarea');
  assert.match(html, /class="licznik"/); assert.doesNotMatch(html, /<head|main\.js|styles\.css/, "z całego dokumentu zostaje treść body");
  await p.selectOption('.panel .f:has-text("Licencja") select', "brand"); await p.waitForTimeout(300);
  // podgląd w edytorze: ramka z działającym kodem
  const prev = p.frames().find((f) => f !== p.mainFrame());
  const demoFrame = async (page) => { for (let i = 0; i < 30; i++) { const f = page.frames().find((x) => x.url().includes("demos/") || x.url() === "about:srcdoc" && x.parentFrame() && x.parentFrame() !== page.mainFrame()); if (f) { try { if (await f.evaluate(() => window.__demo)) return f; } catch {} } await page.waitForTimeout(200); } return null; };
  await prev.evaluate(() => document.querySelector(".code-demo").scrollIntoView());
  const df = await demoFrame(p);
  assert.ok(df, "demo działa w podglądzie");
  // eksport
  const { zip, url } = await exportManual(p, "demo-kodu");
  const dir = Object.keys(zip.files).find((f) => /^demos\/.+\/index\.html$/.test(f));
  assert.ok(dir, "folder demos/ w eksporcie");
  assert.match(await zip.file(dir).async("string"), /fonts\/geist/, "demo ma dostęp do kroju manuala");
  const zpath = Object.keys(zip.files).find((f) => /^files\/.*-kod\.zip$/.test(f));
  const inner = await JSZip.loadAsync(await zip.file(zpath).async("nodebuffer"));
  assert.deepEqual(Object.keys(inner.files).sort(), ["CZYTAJ.txt", "LICENSE.txt", "index.html", "script.js", "style.css"]);
  // licencja: nota i sygnatura w każdym pliku, LICENSE.txt w paczce
  const sig = (await zip.file("index.html").async("string")).match(/data-build="([^"]+)"/)[1];
  const css = await inner.file("style.css").async("string"), lic = await inner.file("LICENSE.txt").async("string");
  assert.match(css, new RegExp("^/\\* [\\s\\S]*Sygnatura: " + sig + "-D[0-9A-F]{6}"), "nota z sygnaturą manuala na początku CSS");
  assert.match(await inner.file("script.js").async("string"), /Wszelkie prawa zastrzeżone/);
  assert.match(await inner.file("index.html").async("string"), /<html lang="pl" data-build="KHOREI-BM-\d{4}-[0-9A-F]{16}-D[0-9A-F]{6}"/);
  assert.match(lic, /Licencja: Do stosowania w marce zamawiającego/); assert.match(lic, /nie oznaczają udzielenia licencji/);
  const v = await viewer(url);
  await v.evaluate(() => document.querySelector(".code-demo").scrollIntoView()); await v.waitForTimeout(800);
  const ef = await demoFrame(v);
  assert.ok(ef, "demo działa w manualu");
  await ef.click(".licznik"); await ef.click(".licznik");
  assert.equal(await ef.$eval(".licznik b", (b) => b.textContent), "2");
  await v.click('.code-demo [data-code-tab="css"]');
  assert.ok(await v.isVisible(".code-demo__code:not([hidden])")); assert.ok(!(await v.isVisible(".code-demo iframe")));
  assert.match(await v.$eval(".code-demo__code:not([hidden])", (e) => e.textContent), /\.licznik/);
  assert.match(await v.$eval(".code-demo__code:not([hidden])", (e) => e.textContent), /^\/\* [\s\S]*Wszelkie prawa zastrzeżone/, "kod w zakładce zaczyna się od noty");
  assert.match(await v.$eval(".code-demo__license", (e) => e.textContent), /Do stosowania w marce/);
  await v.click('.code-demo [data-code-tab="license"]');
  assert.match(await v.$eval(".code-demo__licence:not([hidden])", (e) => e.textContent), /Licencja: Do stosowania w marce zamawiającego[\s\S]*nie oznaczają udzielenia licencji/, "zakładka Licencja z pełną notą");
  assert.ok(await v.$eval("[data-code-copy]", (b) => b.hidden), "na zakładce Licencja bez Kopiuj");
  assert.deepEqual([...v.errors, ...v.missing], []);
  await v.context().close(); await p.context().close();
});

test("Shift+Spacja wstawia twardą spację w polach tekstowych (nie w polach kodu)", async () => {
  const p = await editor("single");
  await p.click('.nav > button:has-text("Marka")');
  const f = '.f:has-text("Nazwa marki") input';
  await p.fill(f, "Nazwa"); await p.focus(f); await p.keyboard.press("End");
  await p.keyboard.press("Shift+Space"); await p.keyboard.type("Marki"); await p.waitForTimeout(500);
  assert.equal(await p.inputValue(f), "Nazwa Marki");
  assert.equal(await p.locator('.f:has-text("Nazwa marki") .f__nbsp b').count(), 1, "twarda spacja widoczna pod polem");
  const fr = p.frames().find((x) => x !== p.mainFrame());
  assert.match(await fr.$eval(".cover__brand", (e) => e.textContent), /Nazwa Marki/, "twarda spacja trafia do manuala");
  await chapter(p, "Animacje"); await p.selectOption(".panel select.add", "code"); await p.waitForTimeout(400);
  const c = '.panel .f:has-text("CSS") textarea';
  await p.focus(c); await p.keyboard.type("a"); await p.keyboard.press("Shift+Space"); await p.keyboard.type("b");
  assert.equal(await p.inputValue(c), "a b", "w polu kodu zwykła spacja");
  await p.context().close();
});

test("demo kodu „Tylko do wglądu”: bez kopiowania, kod niezaznaczalny; opcja ukrycia kodu", async () => {
  const p = await editor("single");
  await loadProject(p, { edit: (d) => { const ch = d.chapters.find((c) => c.title === "Animacje"); ch.sections[0].blocks = [
    { id: "v1", type: "code", line: true, label: "Pokaz", html: "<p>Hej</p>", css: "p{color:red}", js: "window.__demo=1", license: "view", height: 320 },
    { id: "h1", type: "code", line: true, label: "Ukryty", html: "<p>Hej</p>", css: "p{}", js: "", license: "brand", showCode: false, height: 320 }]; } });
  const { url } = await exportManual(p, "demo-wglad");
  const v = await viewer(url);
  const demos = await v.$$(".code-demo");
  assert.equal(await demos[0].$("[data-code-copy]"), null, "bez przycisku Kopiuj");
  assert.equal(await demos[0].$eval(".code-demo__code:not(.code-demo__licence)", (e) => getComputedStyle(e).userSelect), "none");
  assert.match(await demos[0].$eval(".code-demo__license", (e) => e.textContent), /Tylko do wglądu/);
  assert.equal(await demos[0].$('a.code-demo__tool[target="_blank"]'), null, "„Tylko do wglądu” bez Otwórz");
  assert.deepEqual(await demos[1].$$eval("[data-code-tab]", (t) => t.map((x) => x.dataset.codeTab)), ["run", "license"], "ukryty kod: Podgląd i Licencja");
  assert.equal(await demos[1].$(".code-demo__code:not(.code-demo__licence)"), null);
  await v.context().close(); await p.context().close();
});

test("demo kodu: bez licencji brak zakładki i not; własna licencja z pliku LICENSE", async () => {
  const p = await editor("single");
  await chapter(p, "Animacje"); await p.selectOption(".panel select.add", "code"); await p.waitForTimeout(400);
  const F = (n) => path.join(ROOT, "tests/fixtures/demo", n);
  await p.setInputFiles('.panel input[type=file][data-code-files]', [F("index.html"), F("styles.css"), F("main.js")]); await p.waitForTimeout(600);
  const prev = p.frames().find((f) => f !== p.mainFrame());
  assert.equal(await p.inputValue('.panel .f:has-text("Licencja") select'), "view", "nowy blok: domyślnie tylko do wglądu");
  await p.selectOption('.panel .f:has-text("Licencja") select', "none"); await p.waitForTimeout(500);
  assert.deepEqual(await prev.$$eval(".code-demo [data-code-tab]", (t) => t.map((x) => x.dataset.codeTab)), ["run", "html", "css", "js"], "bez licencji — bez zakładki Licencja");
  let { zip } = await exportManual(p, "demo-bez-licencji");
  let inner = await JSZip.loadAsync(await zip.file(Object.keys(zip.files).find((f) => /-kod\.zip$/.test(f))).async("nodebuffer"));
  assert.ok(!inner.files["LICENSE.txt"], "bez LICENSE.txt"); assert.doesNotMatch(await inner.file("style.css").async("string"), /Wszelkie prawa/, "bez noty w pliku");
  // własna licencja: wgrana razem z kodem
  await p.setInputFiles('.panel input[type=file][data-code-files]', [F("LICENSE.txt")]); await p.waitForTimeout(600);
  assert.equal(await p.inputValue('.panel .f:has-text("Licencja") select'), "custom");
  await p.waitForTimeout(400);
  assert.deepEqual(await prev.$$eval(".code-demo [data-code-tab]", (t) => t.map((x) => x.dataset.codeTab)), ["run", "html", "css", "js", "license"]);
  ({ zip } = await exportManual(p, "demo-wlasna-licencja"));
  inner = await JSZip.loadAsync(await zip.file(Object.keys(zip.files).find((f) => /-kod\.zip$/.test(f))).async("nodebuffer"));
  assert.match(await inner.file("LICENSE.txt").async("string"), /Licencja testowa autora[\s\S]*Sygnatura: KHOREI-BM/);
  await p.context().close();
});

test("demo kodu na dotyku: strona przewija się nad demem, demo działa dopiero po dotknięciu", async () => {
  const p = await editor("single");
  await loadProject(p, { edit: (d) => { const ch = d.chapters.find((c) => c.title === "Animacje"); ch.sections[0].blocks = [
    { id: "t1", type: "code", line: true, label: "Dotyk", html: "<p>Hej</p>", css: "", js: "", license: "none", height: 480 }]; } });
  const { url } = await exportManual(p, "demo-dotyk");
  const v = await viewer(url, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await v.evaluate(() => document.querySelector(".code-demo").scrollIntoView({ block: "center" })); await v.waitForTimeout(400);
  assert.ok(await v.isVisible("[data-code-shield]"), "warstwa „Dotknij, aby uruchomić demo”");
  await v.tap("[data-code-shield]");
  assert.ok(await v.$eval(".code-demo", (e) => e.classList.contains("is--active")));
  assert.ok(!(await v.isVisible("[data-code-shield]")) && await v.isVisible("[data-code-done]"), "demo aktywne, jest „Gotowe”");
  await v.tap("[data-code-done]");
  assert.ok(await v.isVisible("[data-code-shield]"), "Gotowe przywraca przewijanie");
  await v.tap("[data-code-shield]"); await v.evaluate(() => window.scrollTo(0, 0)); await v.waitForTimeout(500);
  assert.ok(!(await v.$eval(".code-demo", (e) => e.classList.contains("is--active"))), "zjechanie z dema wyłącza je");
  const d = await viewer(url, { viewport: { width: 1440, height: 900 } });
  assert.ok(!(await d.isVisible("[data-code-shield]")), "na komputerze bez warstwy");
  await v.context().close(); await d.context().close(); await p.context().close();
});
