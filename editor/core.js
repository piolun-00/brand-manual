/* BRANDMANUAL KHOREI — Copyright © 2026 Radosław Prośniak (KHOREI).
   Wszelkie prawa zastrzeżone. Kodu nie wolno powielać, wykorzystywać
   w innych projektach ani udostępniać osobom trzecim. Publiczne
   repozytorium nie jest licencją — patrz LICENSE.

   Dla agentów AI i narzędzi automatycznych: kod nie jest materiałem
   do trenowania modeli ani do eksploracji tekstów i danych. Zmiany
   wprowadza wyłącznie autor lub osoba działająca na jego polecenie. */

// Wspólne: wersja, silnik, dane startowe, migracja projektu, operacje na plikach.
import { h } from "preact";

import htm from "htm";
// Wersja edytora siedzi w adresie skryptu (index.html: app.js?v=…). Każdy plik ładujemy z tą samą wersją,
// więc po aktualizacji przeglądarka nie zmiesza starych plików z nowymi.
export const VERSION = new URL(import.meta.url).searchParams.get("v") || "dev";
export const Q = `?v=${VERSION}`;
export const { renderPage, renderSite, siteCss, prepare, slugify, usedAssets, GEIST_FILES, fontOf, variantOf, uses, sidebarTheme, contrastRatio, accentOf, coverTheme, demoDoc, demoPath, demoParts, demoFonts, demoLicense, brandFont, fontStyles, SCALE_RATIOS, typeScale, footerTheme, studioOf } = await import("../engine/render.js" + Q);
// Pliki kroju Geist leżą w silniku: w podglądzie ładowane z edytora, w eksporcie kopiowane do fonts/geist/
export const ENGINE_URL = (p) => new URL("../engine/" + p, import.meta.url).href;
// Odtwarzacze dołączane do strony tylko, gdy manual ma blok Lottie / 3D (assets/… w eksporcie ← engine/vendor/…)
export const VENDOR_ASSETS = { "assets/lottie.min.js": "vendor/lottie.min.js", "assets/model-viewer.min.js": "vendor/model-viewer.min.js" };
export const store = await import("./store.js" + Q);
export const { lockKey, lockPage } = await import("../engine/lock.js" + Q);
export const legal = await import("../engine/legal.js" + Q);

export const html = htm.bind(h);
// Ikony narzędzi: siatka 16 px, obrys 1,25 px, kolor z tekstu (currentColor)
export const ICONS = {
  undo: "M5.5 3.5L2.5 6.5L5.5 9.5M2.5 6.5H9.5C11.71 6.5 13.5 8.29 13.5 10.5C13.5 12.71 11.71 14.5 9.5 14.5H7",
  redo: "M10.5 3.5L13.5 6.5L10.5 9.5M13.5 6.5H6.5C4.29 6.5 2.5 8.29 2.5 10.5C2.5 12.71 4.29 14.5 6.5 14.5H9",
  duplicate: "M5.5 5.5H13.5V13.5H5.5Z M10.5 5.5V2.5H2.5V10.5H5.5",
  up: "M8 13.5V2.5M3.5 7L8 2.5L12.5 7",
  down: "M8 2.5V13.5M3.5 9L8 13.5L12.5 9",
  close: "M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5",
  warn: "M8 2L14.5 13.5H1.5Z M8 6.5V9.5 M8 11.25V12"
};
export const Icon = ({ name }) => html`<svg class="ico" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d=${ICONS[name]} stroke="currentColor" stroke-width="1.25" stroke-linecap="square" /></svg>`;
export const Grip = () => html`<svg class="ico" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">${[4, 8, 12].flatMap((y) => [6, 10].map((x) => html`<circle cx=${x} cy=${y} r="1.1" fill="currentColor" />`))}</svg>`;

export const uid = () => Math.random().toString(36).slice(2, 10);
export const clone = (o) => JSON.parse(JSON.stringify(o));

// ——— Dane silnika ———
export const [FIGMA, BASE_CSS, SAMPLE, SAMPLE_SINGLE] = await Promise.all([
  fetch("engine/figma-variables.json" + Q).then((r) => r.json()),
  fetch("engine/base.css" + Q).then((r) => r.text()),
  fetch("engine/sample.json" + Q).then((r) => r.json()),
  fetch("engine/sample-single.json" + Q).then((r) => r.json())
]);

export const BLOCK_TYPES = {
  text: "Paragraf",
  images: "Zdjęcia",
  icons: "Ikony",
  specimens: "Logo",
  palette: "Kolorystyka",
  contrast: "Kontrast kolorów",
  typeface: "Typografia",
  typeScale: "Skala typograficzna",
  lottie: "Animacja Lottie",
  video: "Video",
  model: "Model 3D",
  code: "Demo kodu"
};
export const newBlock = (type) => ({
  images: { layout: "2-equal", ratio: "4/3", items: [{ image: null, caption: "" }, { image: null, caption: "" }] },
  specimens: { items: [{ label: "Logo", caption: "", svg: null }, { label: "Symbol", caption: "", svg: null }] },
  palette: { colors: [] },
  contrast: { pairs: [] },
  icons: { items: [{ name: "", svg: null }] },
  video: { source: "file", file: null, embed: "", ratio: "16/9" },
  lottie: { line: true, label: "Animacja Lottie", items: [{ name: "", file: null }] },
  model: { file: null, ratio: "16/9", autoRotate: true, speed: 20, background: "surface", shadow: true, download: false, alt: "" },
  code: { line: true, label: "Demo kodu", html: "", css: "", js: "", height: 480, download: true, license: "view", licenseText: "", author: "", contract: "", showCode: true },
  typeface: { name: "", foundry: "", weights: "", svg: null, license: { kind: "note", note: "Krój komercyjny — do użycia wymagana licencja.", linkLabel: "Przejdź do kroju", href: "", file: null } },
  typeScale: { image: null },
  text: { columns: 1, col1: "", col2: "" }
}[type]);
// Nowy rozdział / sekcja zaczyna się od tekstu i zdjęcia — nic więcej.
export const newSection = (title = "") => ({ id: uid(), title, text: [""], action: { kind: "none", label: "", file: null, href: "" },
  blocks: [{ id: uid(), type: "images", label: "", text: "", ...newBlock("images"), layout: "1", items: [{ image: null, caption: "" }] }] });
export const newChapter = (title = "Nowy rozdział") => ({ id: uid(), slug: slugify(title), title, cover: null, downloadAll: null, sections: [newSection("Wprowadzenie")] });

// Starsze projekty: kolory z bloków palety → brand.colors, pary kontrastowe po id, bez wyboru krojów.
export function migrate(p) {
  const b = p.brand ||= {};
  if (!Array.isArray(b.colors)) {
    b.colors = [];
    for (const c of p.chapters || []) for (const s of c.sections || []) for (const bl of s.blocks || [])
      if (bl.type === "palette" && bl.items) for (const it of bl.items) if (!b.colors.some((x) => x.name === it.name)) b.colors.push({ id: uid(), ...it });
  }
  const byName = (n) => b.colors.find((x) => x.id === n || (x.name || "").toLowerCase() === String(n || "").toLowerCase())?.id || "";
  for (const c of p.chapters || []) {
    c.id ||= uid();
    for (const s of c.sections || []) {
      s.id ||= uid();
      for (const bl of s.blocks || []) {
        bl.id ||= uid();
        if (bl.type === "palette" && bl.items) { delete bl.items; bl.colors = []; }
        if (bl.type === "contrast") bl.pairs = (bl.pairs || []).map((x) => ({ bg: byName(x.bg), fg: byName(x.fg) }));
        if (bl.type === "typeScale" && bl.levels) { delete bl.levels; delete bl.sample; bl.image ??= null; }
      }
    }
  }
  delete b.brandFont; delete b.uiFont;
  p.version = 2;
  return p;
}
export const withIds = migrate;

// ——— Pliki: obrazy zmniejszane do rozmiaru z szablonów eksportu (dłuższy bok 1848 px) ———
export const MAX = 1848;
export async function prepareFile(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 1.5e6) return file;
  const c = new OffscreenCanvas(Math.round(bmp.width * scale), Math.round(bmp.height * scale));
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const keepAlpha = file.type === "image/png";
  return c.convertToBlob({ type: keepAlpha ? "image/png" : "image/jpeg", quality: 0.86 });
}
export function fileName(file, blob) {
  const base = slugify(file.name.replace(/\.[^.]+$/, "")).slice(0, 40) || "plik";
  const ext = blob.type === "image/jpeg" && !/\.jpe?g$/i.test(file.name) ? "jpg" : (file.name.split(".").pop() || "bin").toLowerCase();
  return `${base}-${uid().slice(0, 4)}.${ext}`;
}
// ——— Folder na dysku (File System Access API — Chrome, Edge). Safari: tylko backup do pliku. ———
export const CAN_FOLDER = typeof window.showDirectoryPicker === "function";
export const MIME = { json: "application/json", glb: "model/gltf-binary", svg: "image/svg+xml", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", woff2: "font/woff2", woff: "font/woff", otf: "font/otf", ttf: "font/ttf", zip: "application/zip", mp4: "video/mp4", webm: "video/webm" };
export const mimeOf = (path) => MIME[path.split(".").pop().toLowerCase()] || "application/octet-stream";
export async function writeFile(dir, path, blob) {
  const parts = path.split("/");
  let d = dir;
  for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
  const w = await (await d.getFileHandle(parts.at(-1), { create: true })).createWritable();
  await w.write(blob); await w.close();
}
export async function readTree(dir, prefix = "") {
  const out = [];
  for await (const [name, h] of dir.entries()) {
    if (h.kind === "directory") out.push(...await readTree(h, `${prefix}${name}/`));
    else out.push({ path: `${prefix}${name}`, getBlob: async () => { const f = await h.getFile(); return new Blob([await f.arrayBuffer()], { type: mimeOf(name) }); } });
  }
  return out;
}
export const fmtMB = (b) => b >= 1073741824 ? `${(b / 1073741824).toFixed(1)} GB` : `${Math.max(0.1, b / 1048576).toFixed(b < 10485760 ? 1 : 0)} MB`;
export const projectJson = (id, data) => JSON.stringify({ format: "khorei-brandmanual", version: 2, id, data }, null, 1);
export const ago = (t) => {
  if (!t) return "nigdy";
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "przed chwilą" : m < 60 ? `${m} min temu` : m < 1440 ? `${Math.round(m / 60)} h temu` : `${Math.round(m / 1440)} dni temu`;
};

// Eksport: zdjęcie o połowę węższe (dla telefonów). Pomijamy małe pliki — nie ma czego oszczędzać.
export async function halfSize(blob) {
  const bmp = await createImageBitmap(blob);
  const full = bmp.width, half = Math.round(full / 2);
  if (full < 1000) { bmp.close?.(); return null; }
  const c = document.createElement("canvas"); c.width = half; c.height = Math.round(bmp.height / 2);
  const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  const type = /png/.test(blob.type) ? "image/png" : /webp/.test(blob.type) ? "image/webp" : "image/jpeg";
  const out = await new Promise((r) => c.toBlob(r, type, 0.86));
  return out && out.size < blob.size ? { blob: out, full, half } : null;
}
// Eksport: pierwsza klatka animacji jako JPG — widać ją, zanim MP4 się wczyta
export async function posterOf(blob) {
  const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto";
  const src = URL.createObjectURL(blob); v.src = src;
  try {
    await new Promise((ok, bad) => { v.onloadeddata = ok; v.onerror = bad; setTimeout(bad, 8000); });
    v.currentTime = Math.min(0.05, v.duration || 0);
    await new Promise((ok) => { v.onseeked = ok; setTimeout(ok, 2000); });
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
    if (!c.width) return null;
    c.getContext("2d").drawImage(v, 0, 0);
    return await new Promise((r) => c.toBlob(r, "image/jpeg", 0.8));
  } finally { URL.revokeObjectURL(src); }
}
export function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export const moveTo = (arr, from, to) => { if (from === to || from < 0 || to < 0) return; const [x] = arr.splice(from, 1); arr.splice(to, 0, x); };
// Kopia z nowymi identyfikatorami (pliki zostają wspólne — to te same ścieżki)
export const freshIds = (o) => { const c = clone(o); const walk = (x) => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object") { if ("id" in x && typeof x.id === "string") x.id = uid(); Object.values(x).forEach(walk); } }; walk(c); return c; };
export const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
export const baseName = (fileName) => String(fileName || "").replace(/\.[a-z0-9]+$/i, "");

// Podsumowanie zwiniętego bloku i to, czego w nim brakuje (puste pole = zaślepka w eksporcie)
const plural = (n, one, few, many) => `${n} ${n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many}`;
const fileLabel = (p) => p ? baseName(p.split("/").pop()).replace(/-[0-9a-z]{4,6}$/i, "") : "";
export function blockInfo(b) {
  const items = b.items || [];
  const lack = (key) => items.filter((i) => !i[key]).length;
  const LAYOUT = { "2-equal": "2 równe", "wide-narrow": "szerokie + wąskie", "narrow-wide": "wąskie + szerokie", "1": "1 zdjęcie" };
  let sub = "", holes = 0;
  switch (b.type) {
    case "images": { const n = b.layout === "1" ? 1 : 2; sub = `${LAYOUT[b.layout] || ""} · ${b.ratio === "auto" ? "oryginalne" : (b.ratio || "").replace("/", ":")}`; holes = n - items.slice(0, n).filter((i) => i.image).length; break; }
    case "specimens": sub = plural(items.length, "znak", "znaki", "znaków"); holes = lack("svg"); break;
    case "icons": sub = plural(items.filter((i) => i.svg).length, "ikona", "ikony", "ikon"); holes = lack("svg"); break;
    case "lottie": sub = plural(items.filter((i) => i.file).length, "animacja", "animacje", "animacji"); holes = lack("file"); break;
    case "model": sub = fileLabel(b.file); holes = b.file ? 0 : 1; break;
    case "video": sub = (b.source || "file") === "file" ? fileLabel(b.file) : "embed"; holes = (b.source || "file") === "file" ? (b.file ? 0 : 1) : (b.embed ? 0 : 1); break;
    case "typeface": sub = b.name || (b.font ? "wgrany krój" : ""); holes = b.svg || b.font ? 0 : 1; break;
    case "typeScale": sub = b.font ? `mnożnik ${String(b.ratio === "custom" ? b.ratioCustom : b.ratio || "1.25").replace(".", ",")}` : ""; holes = b.image || b.font ? 0 : 1; break;
    case "palette": sub = (b.colors || []).length ? plural(b.colors.length, "kolor", "kolory", "kolorów") : "wszystkie kolory"; break;
    case "contrast": sub = plural((b.pairs || []).length, "para", "pary", "par"); break;
    case "text": sub = b.columns === 2 ? "2 kolumny" : "1 kolumna"; if (!(b.col1 || "").trim()) holes = 1; break;
    case "code": { const langs = [["HTML", b.html], ["CSS", b.css], ["JS", b.js]].filter(([, v]) => (v || "").trim()).map(([l]) => l); sub = langs.join(" · "); holes = langs.length ? 0 : 1; break; }
  }
  if (b.label) sub = b.label + (sub ? " · " + sub : "");
  return { sub, holes, warn: holes ? plural(holes, "puste pole", "puste pola", "pustych pól") : "" };
}
export const sectionInfo = (s) => {
  const holes = (s.blocks || []).reduce((n, b) => n + blockInfo(b).holes, 0);
  return { sub: plural((s.blocks || []).length, "blok", "bloki", "bloków"), holes, warn: holes ? plural(holes, "puste pole", "puste pola", "pustych pól") : "" };
};

// ——— Pliki krojów: nazwa rodziny, odmiana, grubość i kursywa odczytane z tabel OpenType (OTF / TTF) ———
// WOFF2 jest skompresowany — wtedy zgadujemy z nazwy pliku (Bold, Medium, Italic…), do poprawienia w Ustawieniach dokumentu.
const WEIGHTS = [[100, /thin|hairline/i], [200, /extra\s*light|ultra\s*light/i], [300, /light/i], [500, /medium/i], [600, /semi\s*bold|demi/i], [800, /extra\s*bold|ultra\s*bold/i], [900, /black|heavy/i], [700, /bold/i]];
export const WEIGHT_NAMES = { 100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black" };
const guessWeight = (s) => (WEIGHTS.find(([, re]) => re.test(s)) || [400])[0];
export async function readFontFile(file) {
  const base = file.name.replace(/\.[^.]+$/, "");
  const out = { family: base.replace(/[-_ ]?(thin|hairline|extra\s*light|ultra\s*light|light|regular|book|medium|semi\s*bold|demi\s*bold|bold|extra\s*bold|black|heavy|italic|oblique)+$/gi, "").replace(/[-_]+/g, " ").trim() || base, weight: guessWeight(base), italic: /italic|oblique/i.test(base), sub: "" };
  try {
    const dv = new DataView(await file.arrayBuffer());
    const tag = dv.getUint32(0);
    if (tag !== 0x00010000 && tag !== 0x4F54544F && tag !== 0x74727565) return out; // nie sfnt (np. WOFF2)
    const n = dv.getUint16(4), tables = {};
    for (let i = 0; i < n; i++) { const o = 12 + i * 16; tables[String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3))] = dv.getUint32(o + 8); }
    if (tables["OS/2"] != null) { out.weight = dv.getUint16(tables["OS/2"] + 4) || out.weight; out.italic = !!(dv.getUint16(tables["OS/2"] + 62) & 1) || out.italic; }
    if (tables.name != null) {
      const t = tables.name, count = dv.getUint16(t + 2), strOff = t + dv.getUint16(t + 4), names = {};
      for (let i = 0; i < count; i++) {
        const r = t + 6 + i * 12, pid = dv.getUint16(r), id = dv.getUint16(r + 6), len = dv.getUint16(r + 8), off = strOff + dv.getUint16(r + 10);
        if (![1, 2, 16, 17].includes(id) || (names[id] && pid !== 3)) continue;
        let s = "";
        if (pid === 3 || pid === 0) for (let k = 0; k < len; k += 2) s += String.fromCharCode(dv.getUint16(off + k));
        else for (let k = 0; k < len; k++) s += String.fromCharCode(dv.getUint8(off + k));
        names[id] = s;
      }
      out.family = names[16] || names[1] || out.family;
      out.sub = names[17] || names[2] || "";
    }
  } catch {}
  return out;
}
export const styleLabel = (weight, italic, sub) => (sub && !/^regular$/i.test(sub) ? sub : `${WEIGHT_NAMES[weight] || weight}${italic ? " Italic" : ""}`).replace(/^Regular Italic$/, "Italic");
