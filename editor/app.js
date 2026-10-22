// Edytor brandmanuala KHOREI. Formularze po lewej, podgląd na żywo po prawej.
// Projekt (treść) i pliki zapisują się same w przeglądarce. Backup na dysk = jeden plik .khorei.
// Eksport = ZIP z gotową stroną do wgrania na dowolny serwer.
import { h, render } from "preact";
import { useState, useEffect, useRef, useMemo, useCallback } from "preact/hooks";
import htm from "htm";
// Wersja edytora siedzi w adresie skryptu (index.html: app.js?v=…). Każdy plik ładujemy z tą samą wersją,
// więc po aktualizacji przeglądarka nie zmiesza starych plików z nowymi.
const VERSION = new URL(import.meta.url).searchParams.get("v") || "dev";
const Q = `?v=${VERSION}`;
const { renderPage, renderSite, siteCss, prepare, slugify, usedAssets, GEIST_FILES, fontOf, variantOf } = await import("../engine/render.js" + Q);
// Pliki kroju Geist leżą w silniku: w podglądzie ładowane z edytora, w eksporcie kopiowane do fonts/geist/
const ENGINE_URL = (p) => new URL("../engine/" + p, import.meta.url).href;
const store = await import("./store.js" + Q);
const { lockKey, lockPage } = await import("../engine/lock.js" + Q);

const html = htm.bind(h);
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = (o) => JSON.parse(JSON.stringify(o));

// ——— Dane silnika ———
const [FIGMA, BASE_CSS, SAMPLE, SAMPLE_SINGLE] = await Promise.all([
  fetch("engine/figma-variables.json" + Q).then((r) => r.json()),
  fetch("engine/base.css" + Q).then((r) => r.text()),
  fetch("engine/sample.json" + Q).then((r) => r.json()),
  fetch("engine/sample-single.json" + Q).then((r) => r.json())
]);

const BLOCK_TYPES = {
  text: "Tekst (1 lub 2 kolumny)",
  images: "Rząd zdjęć",
  specimens: "Specimeny znaku",
  palette: "Paleta",
  contrast: "Pary kontrastowe",
  icons: "Ikony",
  typeface: "Krój",
  typeScale: "Skala typograficzna (grafika)",
  video: "Animacja / wideo"
};
const newBlock = (type) => ({
  images: { layout: "2-equal", ratio: "4/3", items: [{ image: null, caption: "" }, { image: null, caption: "" }] },
  specimens: { items: [{ label: "Logo", caption: "", svg: null }, { label: "Symbol", caption: "", svg: null }] },
  palette: { colors: [] },
  contrast: { pairs: [] },
  icons: { items: [{ name: "", svg: null }] },
  video: { source: "file", file: null, embed: "", ratio: "16/9" },
  typeface: { name: "", foundry: "", weights: "", svg: null, license: { kind: "note", note: "Krój komercyjny — do użycia wymagana licencja.", linkLabel: "Przejdź do kroju", href: "", file: null } },
  typeScale: { image: null },
  text: { columns: 1, col1: "", col2: "" }
}[type]);
// Nowy rozdział / sekcja zaczyna się od tekstu i zdjęcia — nic więcej.
const newSection = (title = "") => ({ id: uid(), title, text: [""], action: { kind: "none", label: "", file: null, href: "" },
  blocks: [{ id: uid(), type: "images", label: "", text: "", ...newBlock("images"), layout: "1", items: [{ image: null, caption: "" }] }] });
const newChapter = (title = "Nowy rozdział") => ({ id: uid(), slug: slugify(title), title, cover: null, downloadAll: null, sections: [newSection("Wprowadzenie")] });

// Starsze projekty: kolory z bloków palety → kolory marki, pary kontrastowe po id, bez wyboru krojów.
function migrate(p) {
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
const withIds = migrate;

// ——— Pliki: obrazy zmniejszane do rozmiaru z szablonów eksportu (dłuższy bok 1848 px) ———
const MAX = 1848;
async function prepareFile(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 1.5e6) return file;
  const c = new OffscreenCanvas(Math.round(bmp.width * scale), Math.round(bmp.height * scale));
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const keepAlpha = file.type === "image/png";
  return c.convertToBlob({ type: keepAlpha ? "image/png" : "image/jpeg", quality: 0.86 });
}
function fileName(file, blob) {
  const base = slugify(file.name.replace(/\.[^.]+$/, "")).slice(0, 40) || "plik";
  const ext = blob.type === "image/jpeg" && !/\.jpe?g$/i.test(file.name) ? "jpg" : (file.name.split(".").pop() || "bin").toLowerCase();
  return `${base}-${uid().slice(0, 4)}.${ext}`;
}
// ——— Folder na dysku (File System Access API — Chrome, Edge). Safari: tylko backup do pliku. ———
const CAN_FOLDER = typeof window.showDirectoryPicker === "function";
const MIME = { svg: "image/svg+xml", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", woff2: "font/woff2", woff: "font/woff", zip: "application/zip", mp4: "video/mp4", webm: "video/webm" };
const mimeOf = (path) => MIME[path.split(".").pop().toLowerCase()] || "application/octet-stream";
async function writeFile(dir, path, blob) {
  const parts = path.split("/");
  let d = dir;
  for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
  const w = await (await d.getFileHandle(parts.at(-1), { create: true })).createWritable();
  await w.write(blob); await w.close();
}
async function readTree(dir, prefix = "") {
  const out = [];
  for await (const [name, h] of dir.entries()) {
    if (h.kind === "directory") out.push(...await readTree(h, `${prefix}${name}/`));
    else out.push({ path: `${prefix}${name}`, getBlob: async () => { const f = await h.getFile(); return new Blob([await f.arrayBuffer()], { type: mimeOf(name) }); } });
  }
  return out;
}
const fmtMB = (b) => b >= 1073741824 ? `${(b / 1073741824).toFixed(1)} GB` : `${Math.max(0.1, b / 1048576).toFixed(b < 10485760 ? 1 : 0)} MB`;
const projectJson = (id, data) => JSON.stringify({ format: "khorei-brandmanual", version: 2, id, data }, null, 1);
const ago = (t) => {
  if (!t) return "nigdy";
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "przed chwilą" : m < 60 ? `${m} min temu` : m < 1440 ? `${Math.round(m / 60)} h temu` : `${Math.round(m / 1440)} dni temu`;
};

// Eksport: zdjęcie o połowę węższe (dla telefonów). Pomijamy małe pliki — nie ma czego oszczędzać.
async function halfSize(blob) {
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
async function posterOf(blob) {
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
function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ——— Pola formularza ———
function Text({ label, value, onInput, hint, multiline, placeholder, rows }) {
  return html`<label class="f">
    <span class="f__label">${label}</span>
    ${multiline
      ? html`<textarea rows=${rows || 4} value=${value || ""} placeholder=${placeholder || ""} onInput=${(e) => onInput(e.target.value)} />`
      : html`<input type="text" value=${value ?? ""} placeholder=${placeholder || ""} onInput=${(e) => onInput(e.target.value)} />`}
    ${hint && html`<span class="f__hint">${hint}</span>`}
  </label>`;
}
function Num({ label, value, onInput }) {
  return html`<label class="f f--num"><span class="f__label">${label}</span>
    <input type="number" value=${value ?? ""} onInput=${(e) => onInput(e.target.value === "" ? "" : Number(e.target.value))} /></label>`;
}
function Select({ label, value, options, onChange, hint }) {
  return html`<label class="f"><span class="f__label">${label}</span>
    <select value=${value} onChange=${(e) => onChange(e.target.value)}>
      ${options.map(([v, l]) => html`<option value=${v}>${l}</option>`)}
    </select>${hint && html`<span class="f__hint">${hint}</span>`}</label>`;
}
function Color({ label, value, onInput }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#000000";
  return html`<label class="f"><span class="f__label">${label}</span>
    <span class="color"><input type="color" value=${hex} onInput=${(e) => onInput(e.target.value.toUpperCase())} />
    <input type="text" value=${value || ""} placeholder="#000000" onInput=${(e) => onInput(e.target.value)} /></span></label>`;
}
// Wymiary pliku: SVG z atrybutów width/height albo viewBox, obrazy z pikseli
async function measure(url, path) {
  try {
    if (/\.svg$/i.test(path)) {
      const t = await (await fetch(url)).text();
      const svg = new DOMParser().parseFromString(t, "image/svg+xml").documentElement;
      const vb = (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
      const w = parseFloat(svg.getAttribute("width")) || vb[2], h = parseFloat(svg.getAttribute("height")) || vb[3];
      return w && h ? { w, h } : null;
    }
    if (/\.(jpe?g|png|webp)$/i.test(path)) {
      const img = new Image(); img.src = url; await img.decode();
      return { w: img.naturalWidth, h: img.naturalHeight };
    }
  } catch {}
  return null;
}
const ratioName = (r) => ({ "4/3": "4:3", "3/4": "3:4", "16/9": "16:9", "1/1": "1:1" }[r] || r);
// expect: { w, h } — dokładny format z szablonu (proporcja liczy się, skala nie) · { ratio: "4/3" } · { w } — tylko szerokość
function FileField({ label, value, accept, hint, folder, ctx, onChange, expect }) {
  const ref = useRef();
  const [warn, setWarn] = useState("");
  const [drop, setDrop] = useState(false);
  const name = value ? value.split("/").pop() : null;
  const isImg = value && /\.(svg|jpe?g|png|webp)$/i.test(value);
  useEffect(() => {
    setWarn("");
    if (!expect || !value || !ctx.urls[value]) return;
    let live = true;
    measure(ctx.urls[value], value).then((d) => {
      if (!live || !d) return;
      const r = d.w / d.h, size = `${Math.round(d.w)}×${Math.round(d.h)}`;
      if (expect.ratio && expect.ratio !== "auto") {
        const [a, b] = expect.ratio.split("/").map(Number);
        if (Math.abs(r - a / b) > 0.02) setWarn(`Plik ma ${size}, a blok ma proporcje ${ratioName(expect.ratio)} — obraz zostanie przycięty.`);
      } else if (expect.w && expect.h) {
        if (Math.abs(r - expect.w / expect.h) > 0.01) setWarn(`Plik ma ${size}, szablon z Figmy to ${expect.w}×${expect.h}. Wyeksportuj całą ramkę z szablonu, inaczej znak wyświetli się w innej skali.`);
      } else if (expect.w && Math.round(d.w) % expect.w !== 0) {
        setWarn(`Plik ma szerokość ${Math.round(d.w)} px — najlepiej ${expect.w} px (SVG) albo ${expect.w * 2} px (PNG).`);
      }
    });
    return () => { live = false; };
  }, [value, ctx.urls[value], expect && JSON.stringify(expect)]);
  const take = async (f) => { const path = f && await ctx.addFile(f, folder); if (path) onChange(path); };
  return html`<div class="f">
    <span class="f__label">${label}</span>
    <div class=${`file${drop ? " is--drop" : ""}`}
      onDragOver=${(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDrop(true); } }}
      onDragLeave=${() => setDrop(false)}
      onDrop=${(e) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); setDrop(false); take(e.dataTransfer.files[0]); }}>
      ${isImg && ctx.urls[value] ? html`<img class="file__thumb" src=${ctx.urls[value]} alt="" />` : html`<span class="file__thumb is--empty"></span>`}
      <span class="file__name">${name || "Brak pliku — przeciągnij tutaj"}</span>
      <button type="button" class="btn" onClick=${() => ref.current.click()}>${value ? "Zmień" : "Wgraj"}</button>
      ${value && html`<button type="button" class="btn is--ghost" onClick=${() => onChange(null)}>Usuń</button>`}
      <input ref=${ref} type="file" accept=${accept} hidden onChange=${(e) => { const f = e.target.files[0]; e.target.value = ""; take(f); }} />
    </div>
    ${warn && html`<span class="f__warn">${warn}</span>`}
    ${hint && html`<span class="f__hint">${hint}</span>`}
  </div>`;
}

// Karta na liście: rozwijanie, przeciąganie (uchwyt ⋮⋮), duplikowanie, kolejność, usuwanie.
// drag = { group, index, onMove(from, to) } — przeciągać można tylko w obrębie tej samej listy.
function Row({ id, title, onUp, onDown, onRemove, onDuplicate, open, onToggle, children, sub, drag }) {
  const [over, setOver] = useState(false);
  const dnd = drag ? {
    onDragOver: (e) => { if (e.dataTransfer.types.includes(`kh/${drag.group}`)) { e.preventDefault(); e.stopPropagation(); setOver(true); } },
    onDragLeave: () => setOver(false),
    onDrop: (e) => { const from = e.dataTransfer.getData(`kh/${drag.group}`); setOver(false); if (from === "") return; e.preventDefault(); e.stopPropagation(); drag.onMove(Number(from), drag.index); }
  } : {};
  return html`<div class=${`card${open ? " is--open" : ""}${over ? " is--over" : ""}`} data-card=${id} ...${dnd}>
    <div class="card__head" onClick=${(e) => { if (!e.target.closest(".card__tools, .card__grip")) onToggle(); }}>
      ${drag && html`<span class="card__grip" title="Przeciągnij, żeby zmienić kolejność" draggable="true"
        onDragStart=${(e) => { e.stopPropagation(); e.dataTransfer.setData(`kh/${drag.group}`, String(drag.index)); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setDragImage(e.target.closest(".card"), 20, 20); }}>⋮⋮</span>`}
      <button type="button" class="card__title"><span class="card__chev">${open ? "−" : "+"}</span>${title}${sub && html`<span class="card__sub">${sub}</span>`}</button>
      <span class="card__tools">
        ${onDuplicate && html`<button type="button" title="Duplikuj" onClick=${onDuplicate}>⧉</button>`}
        ${onUp && html`<button type="button" title="W górę" onClick=${onUp}>↑</button>`}
        ${onDown && html`<button type="button" title="W dół" onClick=${onDown}>↓</button>`}
        ${onRemove && html`<button type="button" title="Usuń" onClick=${onRemove}>✕</button>`}
      </span>
    </div>
    ${open && html`<div class="card__body">${children}</div>`}
  </div>`;
}
const moveTo = (arr, from, to) => { if (from === to || from < 0 || to < 0) return; const [x] = arr.splice(from, 1); arr.splice(to, 0, x); };
// Kopia z nowymi identyfikatorami (pliki zostają wspólne — to te same ścieżki)
const freshIds = (o) => { const c = clone(o); const walk = (x) => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object") { if ("id" in x && typeof x.id === "string") x.id = uid(); Object.values(x).forEach(walk); } }; walk(c); return c; };
const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };

// ——— Bloki ———
function ImagesBlock({ b, set, ctx }) {
  const count = b.layout === "1" ? 1 : 2;
  const items = Array.from({ length: count }, (_, i) => b.items?.[i] || { image: null, caption: "" });
  return html`
    <div class="grid2">
      <${Select} label="Układ rzędu" value=${b.layout} onChange=${(v) => set((x) => { x.layout = v; })}
        options=${[["2-equal", "2 zdjęcia, równe"], ["wide-narrow", "2 zdjęcia, szerokie + wąskie"], ["narrow-wide", "2 zdjęcia, wąskie + szerokie"], ["1", "1 zdjęcie, cała szerokość"]]} />
      <${Select} label="Proporcje" value=${b.ratio} onChange=${(v) => set((x) => { x.ratio = v; })}
        options=${[["4/3", "4:3 poziome"], ["3/4", "3:4 pionowe"], ["auto", "Oryginalne"]]} />
    </div>
    ${items.map((it, i) => html`<div class="sub">
      <${FileField} label=${`Zdjęcie ${i + 1}`} value=${it.image} accept="image/*" folder="media" ctx=${ctx} expect=${{ ratio: b.ratio }}
        hint="Szablon z Figmy: 4:3 → 1848×1386, 3:4 → 1386×1848"
        onChange=${(p) => set((x) => { x.items = items.map((o) => ({ ...o })); x.items[i].image = p; })} />
      <${Text} label="Podpis" value=${it.caption} onInput=${(v) => set((x) => { x.items = items.map((o) => ({ ...o })); x.items[i].caption = v; })} />
      <${Text} label="Tekst alternatywny (czytniki ekranu)" value=${it.alt} placeholder=${it.caption || "Co widać na zdjęciu"} onInput=${(v) => set((x) => { x.items = items.map((o) => ({ ...o })); x.items[i].alt = v; })} />
    </div>`)}`;
}
function ListBlock({ items, add, render: r, addLabel }) {
  return html`${items.map(r)}<button type="button" class="btn is--add" onClick=${add}>+ ${addLabel}</button>`;
}
function SpecimensBlock({ b, set, ctx }) {
  return html`<${ListBlock} items=${b.items || []} addLabel="Dodaj wersję znaku"
    add=${() => set((x) => { x.items.push({ label: "", caption: "", svg: null }); })}
    render=${(it, i) => html`<div class="sub">
      <div class="sub__head"><b>Wersja ${i + 1}</b><button type="button" class="link" onClick=${() => set((x) => { x.items.splice(i, 1); })}>Usuń</button></div>
      <div class="grid2"><${Text} label="Nazwa" value=${it.label} placeholder="np. Logo" onInput=${(v) => set((x) => { x.items[i].label = v; })} />
      <${Text} label="Opis" value=${it.caption} placeholder="np. Najczęściej używany" onInput=${(v) => set((x) => { x.items[i].caption = v; })} /></div>
      <${FileField} label="Plik SVG" value=${it.svg} accept=".svg,image/svg+xml" folder="media" ctx=${ctx} expect=${{ w: 924, h: 364 }}
        hint="Ramka 924×364 z Figmy, przezroczysta, znak na środku" onChange=${(p) => set((x) => { x.items[i].svg = p; })} />
    </div>`} />`;
}
function PaletteBlock({ b, set, ctx }) {
  const all = ctx.colors;
  const sel = b.colors || [];
  if (!all.length) return html`<p class="note">Kolory dodajesz raz w „Marka i ustawienia” → Kolory marki. Tu wybierasz, które pokazać.</p>`;
  return html`<span class="f__label">Pokaż kolory (nic nie zaznaczone = wszystkie)</span>
    <div class="checks">${all.map((c) => html`<label class="check"><input type="checkbox" checked=${sel.includes(c.id)}
      onChange=${(e) => set((x) => { const cur = x.colors || []; x.colors = e.target.checked ? all.map((k) => k.id).filter((id) => id === c.id || cur.includes(id)) : cur.filter((id) => id !== c.id); })} />
      <span class="check__chip" style=${`background:${c.hex}`}></span>${c.name || c.hex}</label>`)}</div>`;
}
function ContrastBlock({ b, set, ctx }) {
  const all = ctx.colors;
  const opts = [["", "— wybierz kolor —"], ...all.map((c) => [c.id, c.name || c.hex])];
  if (!all.length) return html`<p class="note">Najpierw dodaj kolory w „Marka i ustawienia” → Kolory marki.</p>`;
  return html`<${ListBlock} items=${b.pairs || []} addLabel="Dodaj parę"
    add=${() => set((x) => { (x.pairs ||= []).push({ bg: "", fg: "" }); })}
    render=${(p, i) => html`<div class="sub grid2x">
      <${Select} label="Tło" value=${p.bg} options=${opts} onChange=${(v) => set((x) => { x.pairs[i].bg = v; })} />
      <${Select} label="Tekst" value=${p.fg} options=${opts} onChange=${(v) => set((x) => { x.pairs[i].fg = v; })} />
      <button type="button" class="link" onClick=${() => set((x) => { x.pairs.splice(i, 1); })}>Usuń</button>
    </div>`} /><p class="note">Poziom WCAG liczy się sam. Para pojawia się w podglądzie, gdy wybierzesz oba kolory.</p>`;
}
function TextBlock({ b, set }) {
  return html`<${Select} label="Układ" value=${String(b.columns || 1)} options=${[["1", "Jedna kolumna"], ["2", "Dwie kolumny"]]} onChange=${(v) => set((x) => { x.columns = Number(v); })} />
    <${Text} label=${b.columns === 2 ? "Kolumna 1" : "Tekst"} multiline value=${b.col1} hint="Pusta linia = nowy akapit" onInput=${(v) => set((x) => { x.col1 = v; })} />
    ${b.columns === 2 && html`<${Text} label="Kolumna 2" multiline value=${b.col2} onInput=${(v) => set((x) => { x.col2 = v; })} />`}`;
}
function IconsBlock({ b, set, ctx }) {
  const ref = useRef();
  return html`<${ListBlock} items=${b.items || []} addLabel="Dodaj ikonę"
    add=${() => set((x) => { (x.items ||= []).push({ name: "", svg: null }); })}
    render=${(it, i) => html`<div class="sub">
      <div class="sub__head"><b>${it.name || `Ikona ${i + 1}`}</b><span>
        <button type="button" class="link" onClick=${() => set((x) => move(x.items, i, -1))}>↑</button>
        <button type="button" class="link" onClick=${() => set((x) => move(x.items, i, 1))}>↓</button>
        <button type="button" class="link" onClick=${() => set((x) => { x.items.splice(i, 1); })}>Usuń</button></span></div>
      <${Text} label="Nazwa" value=${it.name} onInput=${(v) => set((x) => { x.items[i].name = v; })} />
      <${FileField} label="Plik SVG" value=${it.svg} accept=".svg,image/svg+xml" folder="media" ctx=${ctx} onChange=${(p) => set((x) => { x.items[i].svg = p; })} />
    </div>`} />
    <button type="button" class="btn is--add" onClick=${() => ref.current.click()}>+ Wgraj wiele SVG naraz</button>
    <input ref=${ref} type="file" accept=".svg,image/svg+xml" multiple hidden onChange=${async (e) => {
      const files = [...e.target.files]; e.target.value = "";
      const added = [];
      for (const f of files) { const svg = await ctx.addFile(f, "media"); if (svg) added.push({ name: f.name.replace(/\.svg$/i, "").replace(/[-_]+/g, " "), svg }); }
      set((x) => { x.items = [...(x.items || []).filter((k) => k.svg || k.name), ...added]; });
    }} />
    <label class="check"><input type="checkbox" checked=${!!b.currentColor} onChange=${(e) => set((x) => { x.currentColor = e.target.checked; })} />Kopiuj z kolorem currentColor (ikona przejmie kolor tekstu w kodzie)</label>
    <p class="note">8 w rzędzie na desktopie, 6 na tablecie, 4 na telefonie. Kliknięcie kopiuje kod SVG. W eksporcie pojawia się przycisk „Pobierz wszystkie (ZIP)”.</p>`;
}
function VideoBlock({ b, set, ctx }) {
  return html`<div class="grid2">
      <${Select} label="Źródło" value=${b.source || "file"} options=${[["file", "Plik MP4"], ["embed", "Kod embed (Vimeo, Lottie, Rive…)"]]} onChange=${(v) => set((x) => { x.source = v; })} />
      <${Select} label="Proporcje" value=${b.ratio || "16/9"} options=${[["16/9", "16:9"], ["4/3", "4:3"], ["1/1", "1:1"], ["3/4", "3:4"], ["auto", "Z pliku"]]} onChange=${(v) => set((x) => { x.ratio = v; })} />
    </div>
    ${(b.source || "file") === "file"
      ? html`<${FileField} label="Plik MP4" value=${b.file} accept="video/mp4,video/webm" folder="media" ctx=${ctx} hint="Odtwarza się sam, bez dźwięku, w pętli. Najlepiej do 10 MB." onChange=${(p) => set((x) => { x.file = p; })} />`
      : html`<${Text} label="Kod embed" multiline value=${b.embed} placeholder="<iframe src=…></iframe>" hint="Wklej kod z serwisu (Vimeo, YouTube, Lottie, Rive). Zostaje tylko <iframe> z adresem https — skrypty są pomijane dla bezpieczeństwa strony klienta." onInput=${(v) => set((x) => { x.embed = v; })} />`}`;
}
function TypefaceBlock({ b, set, ctx }) {
  const l = b.license || {};
  return html`
    <div class="grid2"><${Text} label="Nazwa kroju" value=${b.name} onInput=${(v) => set((x) => { x.name = v; })} />
    <${Text} label="Odlewnia" value=${b.foundry} onInput=${(v) => set((x) => { x.foundry = v; })} /></div>
    <${Text} label="Odmiany" value=${b.weights} placeholder="Regular, Medium, Bold" onInput=${(v) => set((x) => { x.weights = v; })} />
    <${FileField} label="Specimen SVG" value=${b.svg} accept=".svg,image/svg+xml" folder="media" ctx=${ctx} expect=${{ w: 924, h: 364 }} hint="Ramka 924×364 z Figmy" onChange=${(p) => set((x) => { x.svg = p; })} />
    <${Select} label="Licencja" value=${l.kind || "note"} options=${[["note", "Komercyjna — adnotacja + link do odlewni"], ["file", "Darmowa — plik do pobrania"]]} onChange=${(v) => set((x) => { x.license = { ...l, kind: v }; })} />
    <${Text} label="Adnotacja" value=${l.note} onInput=${(v) => set((x) => { x.license = { ...l, note: v }; })} />
    ${l.kind === "file"
      ? html`<${FileField} label="Plik kroju (ZIP)" value=${l.file} accept=".zip" folder="files" ctx=${ctx} onChange=${(p) => set((x) => { x.license = { ...l, file: p }; })} />`
      : html`<div class="grid2"><${Text} label="Tekst linku" value=${l.linkLabel} onInput=${(v) => set((x) => { x.license = { ...l, linkLabel: v }; })} />
        <${Text} label="Adres odlewni" value=${l.href} placeholder="https://" onInput=${(v) => set((x) => { x.license = { ...l, href: v }; })} /></div>`}`;
}
function TypeScaleBlock({ b, set, ctx }) {
  return html`<${FileField} label="Grafika skali (SVG lub PNG)" value=${b.image} accept=".svg,image/svg+xml,image/png" folder="media" ctx=${ctx} expect=${{ w: 924 }}
    hint="Szerokość 924 px (PNG: 1848 px), wysokość dowolna — strona dopasuje ją sama. Bez webfontu klienta, więc bez problemu z licencją." onChange=${(p) => set((x) => { x.image = p; })} />`;
}
const BLOCK_FORMS = { text: TextBlock, images: ImagesBlock, specimens: SpecimensBlock, palette: PaletteBlock, contrast: ContrastBlock, icons: IconsBlock, typeface: TypefaceBlock, typeScale: TypeScaleBlock, video: VideoBlock };

// ——— Sekcja ———
function SectionForm({ s, set, ctx, open, setOpen, noTitle }) {
  const text = s.text?.length ? s.text : [""];
  const twoCol = text.filter((x) => x.trim()).length > 1;
  const a = s.action || { kind: "none" };
  return html`
    ${!noTitle && html`<${Text} label="Tytuł sekcji" value=${s.title} onInput=${(v) => set((x) => { x.title = v; })} />`}
    <${Text} label="Akapit 1" multiline value=${text[0]} onInput=${(v) => set((x) => { x.text = [v, ...(text.slice(1))]; })} />
    ${text.length > 1
      ? html`<${Text} label="Akapit 2 — tekst w dwóch kolumnach" multiline value=${text[1]} onInput=${(v) => set((x) => { x.text = [text[0], v]; })} />
        <button type="button" class="link" onClick=${() => set((x) => { x.text = [text[0]]; })}>Usuń akapit 2</button>`
      : html`<button type="button" class="link" onClick=${() => set((x) => { x.text = [text[0], ""]; })}>+ Drugi akapit (2 kolumny, bez przycisku)</button>`}
    ${!twoCol && html`<div class="sub">
      <${Select} label="Przycisk przy tekście" value=${a.kind} options=${[["none", "Brak"], ["download", "Pobierz ↓ (plik)"], ["external", "Link zewnętrzny ↗"]]}
        onChange=${(v) => set((x) => { x.action = { ...a, kind: v }; })} />
      ${a.kind !== "none" && html`<${Text} label="Napis" value=${a.label} placeholder=${a.kind === "download" ? "Pobierz" : "np. Makiety edycyjne"} onInput=${(v) => set((x) => { x.action = { ...a, label: v }; })} />`}
      ${a.kind === "download" && html`<${FileField} label="Plik do pobrania" value=${a.file} accept="*/*" folder="files" ctx=${ctx} onChange=${(p) => set((x) => { x.action = { ...a, file: p }; })} />`}
      ${a.kind === "external" && html`<${Text} label="Adres" value=${a.href} placeholder="https://" onInput=${(v) => set((x) => { x.action = { ...a, href: v }; })} />`}
    </div>`}
    <div class="blocks">
      <span class="f__label">Bloki</span>
      ${(s.blocks || []).map((b, i) => {
        const Form = BLOCK_FORMS[b.type];
        const setB = (fn) => set((x) => fn(x.blocks[i]));
        return html`<${Row} key=${b.id} id=${b.id} title=${BLOCK_TYPES[b.type]} open=${open === b.id} onToggle=${() => setOpen(open === b.id ? null : b.id)}
          drag=${{ group: `blocks-${s.id}`, index: i, onMove: (from, to) => set((x) => moveTo(x.blocks, from, to)) }}
          onDuplicate=${() => { const nb = freshIds(b); set((x) => { x.blocks.splice(i + 1, 0, nb); }); setOpen(nb.id); }}
          sub=${b.type === "images" ? `${{ "2-equal": "2 równe", "wide-narrow": "szerokie + wąskie", "narrow-wide": "wąskie + szerokie", "1": "1 zdjęcie" }[b.layout]} · ${b.ratio === "auto" ? "oryginalne" : b.ratio.replace("/", ":")}` : ""}
          onUp=${i > 0 && (() => set((x) => move(x.blocks, i, -1)))} onDown=${i < s.blocks.length - 1 && (() => set((x) => move(x.blocks, i, 1)))}
          onRemove=${() => set((x) => { x.blocks.splice(i, 1); })}>
          <label class="check is--line"><input type="checkbox" checked=${!!b.line} onChange=${(e) => setB((x) => { x.line = e.target.checked; })} />Linia nad blokiem</label>
          <${Text} label="Nazwa bloku (opcjonalna)" value=${b.label} onInput=${(v) => setB((x) => { x.label = v; })} />
          <${Text} label="Opis bloku (opcjonalny)" multiline rows="2" value=${b.text} onInput=${(v) => setB((x) => { x.text = v; })} />
          ${Form && html`<${Form} b=${b} set=${setB} ctx=${ctx} />`}
        <//>`;
      })}
      <select class="add" value="" onChange=${(e) => { const type = e.target.value; e.target.value = ""; if (!type) return; const id = uid(); set((x) => { (x.blocks ||= []).push({ id, type, label: "", text: "", ...newBlock(type) }); }); setOpen(id); }}>
        <option value="">+ Dodaj blok…</option>
        ${Object.entries(BLOCK_TYPES).map(([k, l]) => html`<option value=${k}>${l}</option>`)}
      </select>
    </div>`;
}

// ——— Rozdział ———
function ChapterForm({ c, set, ctx, num, onFocus, single, select }) {
  const [openS, _setOpenS] = useState(null);
  const [openB1, setOpenB1] = useState(null);
  const [openB, setOpenB] = useState(null);
  // Klik w podglądzie: otwórz sekcję i blok, przewiń formularz do karty
  useEffect(() => {
    if (!select) return;
    const s = (c.sections || []).find((x) => x.id === select.section);
    if (!s) return;
    if (single) setOpenB1(select.block || null);
    else { _setOpenS(s.id); setOpenB(select.block || null); }
    setTimeout(() => document.querySelector(`[data-card="${select.block || s.id}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" }), 60);
  }, [select]);
  if (single) {
    // Single site: rozdział = jedna sekcja (tekst, przycisk, bloki)
    const s = c.sections?.[0] || newSection();
    return html`<div class="panel__inner">
      <h2 class="h">${num} ${c.title || "Rozdział"}</h2>
      <${Text} label="Tytuł rozdziału" value=${c.title} onInput=${(v) => set((x) => { x.title = v; if (!x.slugLocked) x.slug = slugify(v); })} />
      <${SectionForm} s=${s} noTitle ctx=${ctx} open=${openB1} setOpen=${setOpenB1}
        set=${(fn) => set((x) => { if (!x.sections?.length) x.sections = [newSection()]; fn(x.sections[0]); })} />
      ${(c.sections?.length || 0) > 1 && html`<p class="note">Ten rozdział ma ${c.sections.length} sekcje z trybu multi site. W single site widać tylko pierwszą.</p>`}
    </div>`;
  }
  const setOpenS = (id) => { _setOpenS(id); onFocus(id ? c.sections.findIndex((s) => s.id === id) : -1); };
  
  return html`<div class="panel__inner">
    <h2 class="h">${num} ${c.title || "Rozdział"}</h2>
    <${Text} label="Tytuł rozdziału" value=${c.title} onInput=${(v) => set((x) => { x.title = v; if (!x.slugLocked) x.slug = slugify(v); })} />
    <${Text} label="Adres strony" value=${c.slug} hint=${`/${c.slug || slugify(c.title)}/ — w trybie multi każdy rozdział to osobna strona`} onInput=${(v) => set((x) => { x.slug = slugify(v); x.slugLocked = true; })} />
    <${FileField} label="Zdjęcie okładki (opcjonalne)" value=${c.cover} accept="image/*" folder="media" ctx=${ctx} expect=${{ w: 1440, h: 900 }} hint="Szablon z Figmy: 1440×900, eksport 2x" onChange=${(p) => set((x) => { x.cover = p; })} />
    <${FileField} label="„Pobierz wszystko” (ZIP pod spisem)" value=${c.downloadAll} accept=".zip" folder="files" ctx=${ctx} onChange=${(p) => set((x) => { x.downloadAll = p; })} />
    <div class="blocks">
      <span class="f__label">Sekcje</span>
      ${(c.sections || []).map((s, i) => html`<${Row} key=${s.id} id=${s.id}
        drag=${{ group: `sections-${c.id}`, index: i, onMove: (from, to) => set((x) => moveTo(x.sections, from, to)) }}
        onDuplicate=${() => { const ns = freshIds(s); ns.title = `${s.title} (kopia)`; set((x) => { x.sections.splice(i + 1, 0, ns); }); setOpenS(ns.id); }}
        title=${`${num.replace(/^0/, "")}.${i} ${s.title || "Sekcja"}`} open=${openS === s.id}
        onToggle=${() => setOpenS(openS === s.id ? null : s.id)}
        onUp=${i > 0 && (() => set((x) => move(x.sections, i, -1)))} onDown=${i < c.sections.length - 1 && (() => set((x) => move(x.sections, i, 1)))}
        onRemove=${() => { if (confirm(`Usunąć sekcję „${s.title || "bez tytułu"}” razem z blokami?`)) set((x) => { x.sections.splice(i, 1); }); }}>
        <${SectionForm} s=${s} set=${(fn) => set((x) => fn(x.sections[i]))} ctx=${ctx} open=${openB} setOpen=${setOpenB} />
      <//>`)}
      <button type="button" class="btn is--add" onClick=${() => { const ns = newSection(); set((x) => { (x.sections ||= []).push(ns); }); setOpenS(ns.id); }}>+ Dodaj sekcję</button>
    </div>
  </div>`;
}

// ——— Marka ———
function BrandForm({ b, set, ctx }) {
  const up = (fn) => set((x) => fn(x));
  return html`<div class="panel__inner">
    <h2 class="h">Marka i ustawienia</h2>
    <div class="grid2"><${Text} label="Nazwa marki" value=${b.name} onInput=${(v) => up((x) => { x.name = v; })} />
    <${Text} label="Tytuł dokumentu" value=${b.documentTitle} placeholder="Księga znaku" onInput=${(v) => up((x) => { x.documentTitle = v; })} /></div>
    <div class="grid2"><${Text} label="Wersja" value=${b.version} onInput=${(v) => up((x) => { x.version = v; })} />
    <${Text} label="Data" value=${b.date} placeholder="październik 2026" onInput=${(v) => up((x) => { x.date = v; })} /></div>
    <${Select} label="Tryb strony" value=${b.mode} options=${[["multi", "Multi site — osobna strona na rozdział"], ["single", "Single site — wszystko na jednej stronie"]]} onChange=${(v) => ctx.switchMode(v)} />
    <${FileField} label="Logo w sidebarze (SVG)" value=${b.logo} accept=".svg,image/svg+xml,image/png" folder="media" ctx=${ctx} expect=${{ w: 210, h: 72 }} hint="Ramka 210×72 z Figmy, przezroczysta" onChange=${(p) => up((x) => { x.logo = p; })} />
    <${Text} label="E-mail w stopce" value=${b.contact} onInput=${(v) => up((x) => { x.contact = v; })} />
    <div class="sub">
      <b class="sub__title">Dostęp</b>
      <${Text} label="Hasło do manuala (puste = otwarty)" value=${b.password} placeholder="np. marka2026" onInput=${(v) => up((x) => { x.password = v; })} />
      <p class="note">Eksport szyfruje treść stron — bez hasła nie da się jej przeczytać. Hasło wpisuje się raz na sesję przeglądarki. Pliki do pobrania (media/, files/) pozostają dostępne pod bezpośrednim adresem, jeśli ktoś go zna.</p>
    </div>
    <div class="sub">
      <b class="sub__title">Ikona karty i udostępnianie</b>
      <${FileField} label="Favicon (SVG lub PNG 512×512)" value=${b.favicon} accept=".svg,image/svg+xml,image/png" folder="media" ctx=${ctx} onChange=${(p) => up((x) => { x.favicon = p; })} />
      <${FileField} label="Obrazek do udostępniania (1200×630)" value=${b.ogImage} accept="image/png,image/jpeg" folder="media" ctx=${ctx} expect=${{ w: 1200, h: 630 }} hint="Pokazuje się, gdy ktoś wklei link do manuala w Slacku, mailu czy na LinkedIn." onChange=${(p) => up((x) => { x.ogImage = p; })} />
      <${Text} label="Adres manuala" value=${b.siteUrl} placeholder="https://klient.pl/brandbook/" hint="Potrzebny, żeby obrazek do udostępniania działał." onInput=${(v) => up((x) => { x.siteUrl = v; })} />
    </div>
    <${Color} label="Kolor akcentu (token brand/accent)" value=${b.accent || "#000000"} onInput=${(v) => up((x) => { x.accent = v; })} />
    <div class="blocks">
      <span class="f__label">Kolory marki — z nich korzystają bloki „Paleta” i „Pary kontrastowe”</span>
      ${(b.colors || []).map((c, i) => html`<div class="sub">
        <div class="sub__head"><b><span class="check__chip" style=${`background:${c.hex}`}></span> ${c.name || `Kolor ${i + 1}`}</b><span>
          <button type="button" class="link" onClick=${() => up((x) => move(x.colors, i, -1))}>↑</button>
          <button type="button" class="link" onClick=${() => up((x) => move(x.colors, i, 1))}>↓</button>
          <button type="button" class="link" onClick=${() => up((x) => { x.colors.splice(i, 1); })}>Usuń</button></span></div>
        <div class="grid2"><${Text} label="Nazwa" value=${c.name} onInput=${(v) => up((x) => { x.colors[i].name = v; })} />
        <${Color} label="HEX" value=${c.hex} onInput=${(v) => up((x) => { x.colors[i].hex = v; })} /></div>
        <div class="grid2"><${Text} label="RGB" value=${c.rgb} placeholder="28 28 28" onInput=${(v) => up((x) => { x.colors[i].rgb = v; })} />
        <${Text} label="CMYK" value=${c.cmyk} placeholder="0 0 0 95" onInput=${(v) => up((x) => { x.colors[i].cmyk = v; })} /></div>
        <div class="grid2"><${Text} label="Pantone" value=${c.pantone} onInput=${(v) => up((x) => { x.colors[i].pantone = v; })} />
        <${Text} label="RAL" value=${c.ral} onInput=${(v) => up((x) => { x.colors[i].ral = v; })} /></div>
      </div>`)}
      <button type="button" class="btn is--add" onClick=${() => up((x) => { (x.colors ||= []).push({ id: uid(), name: "", hex: "#000000", rgb: "", cmyk: "", pantone: "", ral: "" }); })}>+ Dodaj kolor</button>
    </div>
    <${Select} label="Krój manuala" value=${fontOf({ brand: b })} options=${[["geist", "Geist (domyślny, darmowa licencja OFL)"], ["areal", "ABC Areal — tylko z licencją webową klienta"], ["system", "Systemowy (SF Pro, Segoe UI, Helvetica, Arial)"]]} onChange=${(v) => up((x) => { x.font = v; })} />
    <p class="note">${fontOf({ brand: b }) === "areal" ? "Licencja Dinamo obejmuje jedną domenę i jednego licencjobiorcę — klient musi kupić własną licencję webową na swoją domenę. Pliki wgrywasz w menu projektu → Krój ABC Areal." : fontOf({ brand: b }) === "geist" ? "Geist jest na licencji SIL Open Font License — wolno go dołączyć do strony klienta. Pliki (ok. 95 KB) trafiają do eksportu." : "Bez plików fontu — każdy zobaczy krój swojego systemu."}</p>
  </div>`;
}

// ——— Podgląd ———
const PRESETS = [390, 768, 1280, 1440, 1920, 2560];
function Preview({ project, page, setPage, urls, focus, studio, onSelect }) {
  const selectRef = useRef(); selectRef.current = onSelect;
  const stage = useRef(), frame = useRef();
  const [width, setWidth] = useState(() => { try { return Number(localStorage.getItem("kh-preview-width")) || 1440; } catch { return 1440; } });
  const [box, setBox] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(stage.current); return () => ro.disconnect();
  }, []);
  useEffect(() => { try { localStorage.setItem("kh-preview-width", String(width)); } catch {} }, [width]);
  const single = project.brand.mode === "single";
  const doc = useMemo(() => {
    const url = (p) => urls[p] || studio.urls[p] || (p.startsWith("fonts/geist/") ? ENGINE_URL(p) : p);
    const ctx = {
      preview: true, url,
      link: (target) => target === "index" ? `href="#" data-page="index"` : single ? `href="#${target}"` : `href="#" data-page="${target}"`,
      css: { inline: siteCss(project, FIGMA, BASE_CSS, url, studio.fonts) }
    };
    const slug = page === "index" ? "index" : (prepare(project).chapters.find((c) => c.id === page)?.slug || "index");
    return renderPage(project, single ? "index" : slug, ctx);
  }, [project, page, urls, single, studio]);
  const pending = useRef(null);
  const scrollTo = (anchor) => {
    if (!frame.current || frame.current.dataset.loading) return false;
    const win = frame.current.contentWindow, el = frame.current.contentDocument?.getElementById(anchor);
    // scrollTo okna ramki, nie scrollIntoView — to drugie przewija też edytor (Safari)
    if (el) { win.scrollTo(0, el.getBoundingClientRect().top + win.scrollY); return true; }
    return false;
  };
  // Podmiana treści ramki z zachowaniem przewinięcia
  useEffect(() => {
    const f = frame.current; if (!f) return;
    const shown = single ? "index" : page; // single site to zawsze jedna strona
    const samePage = f.dataset.page === shown;
    // Ta sama strona: podmieniamy tylko treść dokumentu — bez przeładowania ramki,
    // więc przewinięcie zostaje dokładnie tam, gdzie było (także w Safari) i nic nie mruga.
    const d = f.contentDocument;
    if (samePage && !f.dataset.loading && d?.body && d.documentElement.hasAttribute("data-preview")) {
      const nd = new DOMParser().parseFromString(doc, "text/html");
      const y = f.contentWindow.scrollY;
      d.head.innerHTML = nd.head.innerHTML;
      d.body.innerHTML = nd.body.innerHTML; // skrypt strony już działa (zdarzenia na document), nie uruchamia się drugi raz
      f.contentWindow.scrollTo(0, y);
      if (pending.current) { scrollTo(pending.current); pending.current = null; }
      return;
    }
    const y = f.contentWindow?.scrollY || 0;
    f.dataset.page = shown;
    f.dataset.loading = "1";
    f.srcdoc = doc;
    f.onload = () => {
      delete f.dataset.loading;
      if (pending.current) { scrollTo(pending.current); pending.current = null; }
      else if (samePage) f.contentWindow.scrollTo(0, y);
    };
  }, [doc]);
  // Otwarta sekcja w formularzu = podgląd przewija się do niej
  useEffect(() => {
    if (page === "index") return;
    const c = prepare(project).chapters.find((x) => x.id === page);
    // Single site: wybór rozdziału przewija do niego; otwarta sekcja — do sekcji
    const anchor = focus != null && focus >= 0 ? c?.sections[focus]?.anchor : single ? c?.slug : null;
    if (!anchor) return;
    // Jeśli ramka akurat się przeładowuje (inny rozdział w multi), przewinięcie czeka na załadowanie
    if (!scrollTo(anchor)) pending.current = anchor;
  }, [focus, page, single]);
  useEffect(() => {
    const on = (e) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.khorei === "page") setPage(e.data.page);
      if (e.data?.khorei === "select") selectRef.current?.({ section: e.data.section, block: e.data.block });
    };
    addEventListener("message", on); return () => removeEventListener("message", on);
  }, []);
  const scale = Math.min(1, (box.w - 32) / width);
  return html`<section class="preview">
    <div class="preview__bar">
      <span class="preview__presets">${PRESETS.map((w) => html`<button type="button" aria-pressed=${w === width} onClick=${() => setWidth(w)}>${w}</button>`)}</span>
      <input type="range" min="360" max="2560" value=${width} onInput=${(e) => setWidth(Number(e.target.value))} aria-label="Szerokość ekranu" />
      <span class="preview__info">${width} px · ${width >= 1280 ? "Desktop" : width >= 768 ? "Tablet" : "Mobile"} · ${Math.round(scale * 100)}%</span>
    </div>
    <div class="preview__stage" ref=${stage}>
      <div class="preview__frame" style=${`width:${width}px;height:${Math.max(400, (box.h - 32) / scale)}px;transform:translateX(${-(width * scale) / 2}px) scale(${scale})`}>
        <iframe ref=${frame} title="Podgląd manuala" sandbox="allow-scripts allow-same-origin" />
      </div>
    </div>
  </section>`;
}

// ——— Aplikacja ———
function App() {
  const [projects, setProjects] = useState([]);
  const [pid, setPid] = useState(null);
  const [project, setProject] = useState(null);
  const [urls, setUrls] = useState({});
  const [view, setView] = useState("brand"); // "brand" | id rozdziału
  const [page, setPage] = useState("index");
  const [status, setStatus] = useState("");
  const [menu, setMenu] = useState(false);
  const [focus, setFocus] = useState(-1);
  const [navOver, setNavOver] = useState(null);
  const [select, setSelect] = useState(null); // klik w podglądzie → { section, block }
  const [studio, setStudio] = useState({ fonts: [], urls: {} }); // pliki ABC Areal — wspólne dla wszystkich projektów
  const saveTimer = useRef();
  const folderRef = useRef(null);
  const [newVersion, setNewVersion] = useState(null);
  const [folder, setFolder] = useState(null); // { handle, name, ok }
  const [sizes, setSizes] = useState({}); // ścieżka pliku → bajty (ten projekt)
  const [quota, setQuota] = useState(null);
  const refreshQuota = async () => { try { const e = await navigator.storage.estimate(); setQuota(e); } catch {} };
  // Prośba, żeby przeglądarka nie czyściła danych edytora przy braku miejsca
  useEffect(() => { navigator.storage?.persist?.().catch(() => {}); refreshQuota(); }, []);
  const [meta, setMetaState] = useState({});
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 60000); return () => clearInterval(t); }, []);

  // Nowa wersja edytora na serwerze → pasek z prośbą o odświeżenie
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" });
        const { version } = await r.json();
        if (VERSION !== "dev" && version && version !== VERSION) setNewVersion(version);
      } catch {}
    };
    check();
    const t = setInterval(check, 5 * 60 * 1000);
    addEventListener("focus", check);
    return () => { clearInterval(t); removeEventListener("focus", check); };
  }, []);

  // Krój studia: pliki trzymane w przeglądarce pod kluczem „_studio”, trafiają do każdego eksportu
  async function loadStudio() {
    const fonts = [], u = {};
    for (const path of await store.assetKeys("_studio")) {
      const blob = await store.getAsset("_studio", path);
      if (!blob) continue;
      u[path] = URL.createObjectURL(blob);
      fonts.push({ path, style: /italic/i.test(path) ? "italic" : "normal" });
    }
    setStudio({ fonts, urls: u });
  }
  async function setStudioFont(style, file) {
    for (const f of studio.fonts.filter((x) => x.style === style)) await store.deleteAsset("_studio", f.path);
    if (file) await store.putAsset("_studio", `fonts/abc-areal-${style}.${file.name.split(".").pop().toLowerCase()}`, file);
    await loadStudio(); setStatus(file ? "Krój zapisany dla wszystkich projektów" : "Krój usunięty");
  }

  const refreshList = useCallback(async () => setProjects(await store.listProjects()), []);
  useEffect(() => { (async () => {
    const list = await store.listProjects(); setProjects(list);
    let last; try { last = localStorage.getItem("kh-last"); } catch {}
    const id = list.find((p) => p.id === last)?.id || list[0]?.id;
    loadStudio();
    if (id) open(id); else newProject("multi");
  })(); }, []);

  async function open(id) {
    const rec = await store.getProject(id);
    if (!rec) return;
    Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
    const map = {};
    const sz = {};
    for (const path of await store.assetKeys(id)) { const blob = await store.getAsset(id, path); if (blob) { map[path] = URL.createObjectURL(blob); sz[path] = blob.size; } }
    setSizes(sz); refreshQuota();
    undoStack.current = []; redoStack.current = [];
    setUrls(map); setPid(id); setProject(withIds(rec.data)); setView("brand"); setPage("index"); setMenu(false);
    const m = await store.getMeta(id); setMetaState(m);
    if (m.dir && CAN_FOLDER) {
      const ok = (await m.dir.queryPermission({ mode: "readwrite" })) === "granted";
      setFolder({ handle: m.dir, name: m.dir.name, ok });
    } else setFolder(null);
    try { localStorage.setItem("kh-last", id); } catch {}
  }
  async function newProject(kind) {
    const id = uid();
    const data = withIds(clone(kind === "single" ? SAMPLE_SINGLE : SAMPLE));
    await store.putProject({ id, name: data.brand.name, data });
    await refreshList(); await open(id);
  }
  // Każda zmiana: nowy stan + zapis w przeglądarce po chwili ciszy
  // Cofanie: stos poprzednich stanów. Szybkie pisanie (zmiany w odstępie < 1 s) to jeden krok.
  const undoStack = useRef([]), redoStack = useRef([]), lastPush = useRef(0);
  const [, historyTick] = useState(0);
  const scheduleSave = (next) => {
      clearTimeout(saveTimer.current); setStatus("Zapisuję…");
      saveTimer.current = setTimeout(async () => {
        await store.putProject({ id: pid, name: next.brand.name || "Bez nazwy", data: next });
        await store.setMeta(pid, { lastChange: Date.now() });
        if (folderRef.current?.ok) {
          try {
            await writeFile(folderRef.current.handle, "project.json", new Blob([projectJson(pid, next)], { type: "application/json" }));
            await store.setMeta(pid, { lastBackup: Date.now() });
            setStatus(`Zapisano w przeglądarce i w folderze „${folderRef.current.name}”`);
          } catch { setFolder((f) => f && { ...f, ok: false }); setStatus("Zapisano w przeglądarce — folder wymaga ponownej zgody"); }
        } else setStatus("Zapisano w przeglądarce");
        setMetaState(await store.getMeta(pid)); refreshList();
      }, 500);
  };
  const update = useCallback((fn) => {
    setProject((prev) => {
      const next = clone(prev); fn(next);
      const now = Date.now();
      if (now - lastPush.current > 1000) { undoStack.current.push(prev); if (undoStack.current.length > 200) undoStack.current.shift(); }
      lastPush.current = now; redoStack.current = [];
      historyTick((x) => x + 1);
      scheduleSave(next);
      return next;
    });
  }, [pid]);
  const undo = () => setProject((cur) => {
    const prev = undoStack.current.pop(); if (!prev) return cur;
    redoStack.current.push(cur); lastPush.current = 0; historyTick((x) => x + 1);
    scheduleSave(prev); setStatus("Cofnięto"); return prev;
  });
  const redo = () => setProject((cur) => {
    const next = redoStack.current.pop(); if (!next) return cur;
    undoStack.current.push(cur); lastPush.current = 0; historyTick((x) => x + 1);
    scheduleSave(next); setStatus("Przywrócono"); return next;
  });
  // Cmd+Z / Cmd+Shift+Z (Ctrl na Windows) — cały projekt, także w polach tekstowych
  useEffect(() => {
    const on = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault(); e.shiftKey ? redo() : undo();
    };
    addEventListener("keydown", on); return () => removeEventListener("keydown", on);
  });


  const addFile = useCallback(async (file, folder) => {
    const mb = file.size / 1048576;
    if (/^video\//.test(file.type) && mb > 10 && !confirm(`Plik „${file.name}” ma ${mb.toFixed(0)} MB. Manual będzie się długo ładował, a projekt zajmie dużo miejsca.\n\nNajlepiej skompresować animację do ok. 5–10 MB (np. HandBrake, 1080p). Wgrać mimo to?`)) return null;
    if (!/^(video|image)\//.test(file.type) && mb > 50 && !confirm(`Plik „${file.name}” ma ${mb.toFixed(0)} MB. Wgrać mimo to?`)) return null;
    const blob = await prepareFile(file);
    const path = `${folder}/${fileName(file, blob)}`;
    await store.putAsset(pid, path, blob);
    if (folderRef.current?.ok) writeFile(folderRef.current.handle, `assets/${path}`, blob).catch(() => {});
    setUrls((u) => ({ ...u, [path]: URL.createObjectURL(blob) }));
    setSizes((x) => ({ ...x, [path]: blob.size })); refreshQuota();
    return path;
  }, [pid]);

  const site = project && prepare(project);
  const colors = (project?.brand?.colors || []).filter((c) => c.hex);
  const paletteNames = useMemo(() => {
    const n = [];
    for (const c of project?.chapters || []) for (const s of c.sections || []) for (const b of s.blocks || [])
      if (b.type === "palette") for (const i of b.items || []) if (i.name) n.push(i.name);
    return [...new Set(n)];
  }, [project]);
  // Zmiana trybu strony: single = rozdział to jedna sekcja, więc przy przejściu z multi pytamy o konwersję
  function switchMode(mode) {
    if (mode === project.brand.mode) return;
    if (mode === "single") {
      const many = project.chapters.filter((c) => (c.sections || []).length > 1).length;
      const flatten = many > 0 && confirm(`W single site rozdział to jedna sekcja. ${many} ${many === 1 ? "rozdział ma" : "rozdziały mają"} kilka sekcji.\n\nOK — zamień każdą sekcję w osobny rozdział (nic nie zginie).\nAnuluj — zostaw strukturę (w podglądzie widać tylko pierwszą sekcję rozdziału).`);
      update((p) => {
        p.brand.mode = "single";
        if (flatten) p.chapters = p.chapters.flatMap((c) => (c.sections || []).length > 1
          ? c.sections.map((s) => ({ id: uid(), slug: "", title: s.title || c.title, cover: null, downloadAll: null, sections: [{ ...s, title: s.title || c.title }] }))
          : [c]);
      });
      setStatus(flatten ? "Tryb single site — sekcje są teraz rozdziałami" : "Tryb single site");
    } else {
      update((p) => {
        p.brand.mode = "multi";
        for (const c of p.chapters) for (const s of c.sections || []) if (!s.title) s.title = c.title;
      });
      setStatus("Tryb multi site — każdy rozdział to osobna strona");
    }
    setView("brand"); setPage("index");
  }
  const ctx = { urls, addFile, paletteNames, colors, switchMode };

  // ——— Eksport i backup ———
  async function exportZip() {
    setStatus("Przygotowuję eksport…");
    const zip = new JSZip();
    const font = fontOf(project), missing = [];
    const extra = { variants: new Map(), posters: new Set(), iconZips: new Map() };
    for (const path of usedAssets(project)) { const blob = await store.getAsset(pid, path); blob ? zip.file(path, blob) : missing.push(path); }
    // Zdjęcia z bloków „Rząd zdjęć”: wersja o połowę mniejsza dla telefonów (srcset)
    const walkBlocks = (fn) => { for (const c of project.chapters || []) for (const s of c.sections || []) for (const bl of s.blocks || []) fn(bl); };
    const photos = new Set(), videos = new Set(), iconBlocks = [];
    walkBlocks((bl) => {
      if (bl.type === "images") for (const it of bl.items || []) if (it.image && /\.(jpe?g|png|webp)$/i.test(it.image)) photos.add(it.image);
      if (bl.type === "video" && (bl.source || "file") === "file" && bl.file) videos.add(bl.file);
      if (bl.type === "icons" && (bl.items || []).some((i) => i.svg)) iconBlocks.push(bl);
    });
    let n = 0;
    for (const path of photos) {
      setStatus(`Przygotowuję zdjęcia dla telefonów… ${++n}/${photos.size}`);
      const blob = await store.getAsset(pid, path); if (!blob) continue;
      try { const r = await halfSize(blob); if (r) { zip.file(variantOf(path), r.blob); extra.variants.set(path, { full: r.full, half: r.half }); } } catch {}
    }
    for (const path of videos) {
      setStatus("Przygotowuję klatki startowe animacji…");
      const blob = await store.getAsset(pid, path); if (!blob) continue;
      try { const poster = await posterOf(blob); if (poster) { zip.file(path.replace(/\.[a-z0-9]+$/i, "-poster.jpg"), poster); extra.posters.add(path); } } catch {}
    }
    for (const bl of iconBlocks) {
      const iz = new JSZip(), names = new Set();
      for (const it of bl.items) {
        if (!it.svg) continue;
        const blob = await store.getAsset(pid, it.svg); if (!blob) continue;
        let name = slugify(it.name) || it.svg.split("/").pop().replace(/\.svg$/i, ""), k = 2;
        while (names.has(name)) name = `${slugify(it.name)}-${k++}`;
        names.add(name); iz.file(`${name}.svg`, blob);
      }
      const zpath = `files/${slugify(project.brand.name) || "marka"}-ikony${iconBlocks.length > 1 ? `-${iconBlocks.indexOf(bl) + 1}` : ""}.zip`;
      zip.file(zpath, await iz.generateAsync({ type: "blob", compression: "DEFLATE" }));
      if (bl.id) extra.iconZips.set(bl.id, zpath);
    }
    const pw = (project.brand.password || "").trim();
    const lock = pw ? await lockKey(pw) : null;
    if (lock) setStatus("Szyfruję strony…");
    for (const f of renderSite(project, FIGMA, BASE_CSS, studio.fonts, extra)) {
      zip.file(f.path, lock && f.path.endsWith(".html")
        ? await lockPage(f.content, lock, { title: `${project.brand.name || ""} · ${project.brand.documentTitle || ""}`, accent: "#111111" })
        : f.content);
    }
    if (font === "areal") for (const f of studio.fonts) zip.file(f.path, await store.getAsset("_studio", f.path));
    if (font === "geist") {
      for (const p of GEIST_FILES) zip.file(p, await fetch(ENGINE_URL(p)).then((r) => r.blob()));
      zip.file("fonts/geist/LICENSE.txt", await fetch(ENGINE_URL("fonts/geist/LICENSE.txt")).then((r) => r.blob()));
    }
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    download(blob, `${slugify(project.brand.name)}-brandmanual-${(project.brand.version || "1.0").replace(/[^0-9a-z.]/gi, "")}.zip`);
    setStatus(missing.length ? `Eksport gotowy — brakuje ${missing.length} plików` : "Eksport gotowy");
  }
  async function backup() {
    const zip = new JSZip();
    zip.file("project.json", projectJson(pid, project));
    for (const path of await store.assetKeys(pid)) { if (!usedAssets(project).includes(path)) continue; zip.file(`assets/${path}`, await store.getAsset(pid, path)); }
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    const d = new Date(), stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    download(blob, `${slugify(project.brand.name)}-${stamp}.khorei`);
    await store.setMeta(pid, { lastBackup: Date.now() }); setMetaState(await store.getMeta(pid));
    setStatus("Backup pobrany");
  }
  // Wspólne wczytywanie: z pliku .khorei albo z folderu
  async function importProject(meta, files, dirHandle) {
    if (meta.format !== "khorei-brandmanual") throw new Error("To nie jest projekt KHOREI.");
    let id = meta.id || uid();
    if (projects.some((p) => p.id === id)) {
      if (!confirm(`Projekt „${meta.data.brand?.name}” już jest w edytorze. Zastąpić go wersją z dysku?\n\nAnuluj = wczytaj jako kopię.`)) id = uid();
      else await store.deleteProject(id);
    }
    for (const f of files) if (f.path.startsWith("assets/")) await store.putAsset(id, f.path.slice(7), await f.getBlob());
    await store.putProject({ id, name: meta.data.brand?.name || "Projekt", data: withIds(meta.data) });
    if (dirHandle) await store.setMeta(id, { dir: dirHandle, lastBackup: Date.now() });
    await refreshList(); await open(id);
  }
  // Folder na dysku: od teraz każda zmiana zapisuje się też tam (project.json + assets/)
  async function linkFolder() {
    try {
      const dir = await window.showDirectoryPicker({ id: "khorei-manual", mode: "readwrite" });
      setStatus("Zapisuję projekt w folderze…");
      await writeFile(dir, "project.json", new Blob([projectJson(pid, project)], { type: "application/json" }));
      for (const path of await store.assetKeys(pid)) await writeFile(dir, `assets/${path}`, await store.getAsset(pid, path));
      await store.setMeta(pid, { dir, lastBackup: Date.now() }); setMetaState(await store.getMeta(pid));
      setFolder({ handle: dir, name: dir.name, ok: true });
      setStatus(`Projekt zapisuje się w folderze „${dir.name}”`);
    } catch (e) { if (e.name !== "AbortError") alert("Nie udało się zapisać w folderze: " + e.message); }
  }
  async function resumeFolder() {
    if ((await folder.handle.requestPermission({ mode: "readwrite" })) === "granted") {
      setFolder({ ...folder, ok: true });
      await writeFile(folder.handle, "project.json", new Blob([projectJson(pid, project)], { type: "application/json" }));
      setStatus(`Zapis do folderu „${folder.name}” wznowiony`);
    }
  }
  async function openFolder() {
    try {
      const dir = await window.showDirectoryPicker({ id: "khorei-manual", mode: "readwrite" });
      const files = await readTree(dir);
      const pj = files.find((f) => f.path === "project.json");
      if (!pj) throw new Error("W tym folderze nie ma pliku project.json.");
      await importProject(JSON.parse(await (await pj.getBlob()).text()), files, dir);
      setStatus(`Wczytano z folderu „${dir.name}” — zmiany zapisują się tam dalej`);
    } catch (e) { if (e.name !== "AbortError") alert("Nie udało się wczytać folderu: " + e.message); }
  }
  async function restore(file) {
    try {
      const zip = await JSZip.loadAsync(file);
      const meta = JSON.parse(await zip.file("project.json").async("string"));
      const files = Object.entries(zip.files).filter(([, e]) => !e.dir).map(([name, e]) => ({ path: name, getBlob: async () => new Blob([await e.async("arraybuffer")], { type: mimeOf(name) }) }));
      await importProject(meta, files);
      setStatus("Backup wczytany");
    } catch (e) { alert("Nie udało się wczytać pliku: " + e.message); }
  }
  async function remove() {
    if (!confirm(`Usunąć projekt „${project.brand.name}” z tej przeglądarki? Zrób najpierw backup, jeśli go potrzebujesz.`)) return;
    await store.deleteProject(pid); const list = await store.listProjects(); setProjects(list);
    list[0] ? open(list[0].id) : newProject("multi");
  }

  folderRef.current = folder;
  if (!project) return html`<div class="loading">Ładuję edytor…</div>`;
  const stale = !folder?.ok && meta.lastChange && (!meta.lastBackup || meta.lastChange - meta.lastBackup > 0) && Date.now() - (meta.lastBackup || 0) > 60 * 60000;
  const single = project.brand.mode === "single";
  const chapter = project.chapters.find((c) => c.id === view);
  const chapterIndex = project.chapters.indexOf(chapter);

  return html`<div class=${`app${newVersion ? " has--banner" : ""}`}>
    ${newVersion && html`<div class="banner">Jest nowa wersja edytora. Zapisz pracę i odśwież stronę skrótem <b>Cmd+Shift+R</b> — wszystkie projekty zostaną.
      <button type="button" class="btn is--primary" onClick=${() => location.reload()}>Odśwież</button></div>`}
    <header class="top">
      <span class="top__brand">KHOREI <span>brandmanual</span> <small>v${VERSION}</small></span>
      <div class="top__project">
        <button type="button" class="btn is--ghost" onClick=${() => setMenu(!menu)}>${project.brand.name || "Bez nazwy"} ▾</button>
        ${menu && html`<div class="menu" onMouseLeave=${() => setMenu(false)}>
          <span class="menu__label">Projekty w tej przeglądarce</span>
          <span class="menu__usage">Ten projekt: <b>${fmtMB(usedAssets(project).reduce((n, p) => n + (sizes[p] || 0), 0))}</b>${quota ? html` · edytor razem: ${fmtMB(quota.usage)} z ${fmtMB(quota.quota)}` : ""}</span>
          ${projects.map((p) => html`<button type="button" class=${p.id === pid ? "is--on" : ""} onClick=${() => open(p.id)}>${p.name || "Bez nazwy"}<small>${new Date(p.updated).toLocaleDateString("pl-PL")}</small></button>`)}
          <hr />
          <button type="button" onClick=${() => newProject("multi")}>+ Nowy multi site (21 rozdziałów: tekst + zdjęcie)</button>
          <button type="button" onClick=${() => newProject("single")}>+ Nowy single site (komplet przykładów)</button>
          <hr />
          <span class="menu__label">Krój ABC Areal (webfont, dla wszystkich projektów)</span>
          ${["normal", "italic"].map((st) => { const f = studio.fonts.find((x) => x.style === st); return html`<label class="menu__file">
            <span>${st === "normal" ? "Prosty" : "Kursywa"}: <small>${f ? f.path.split("/").pop() : "brak — eksport użyje kroju z komputera odbiorcy"}</small></span>
            <input type="file" accept=".woff2,.woff" onChange=${(e) => { const file = e.target.files[0]; e.target.value = ""; if (file) setStudioFont(st, file); }} /></label>`; })}
          <hr />
          ${CAN_FOLDER && html`<button type="button" onClick=${openFolder}>Otwórz projekt z folderu na dysku…</button>`}
          <button type="button" class="is--danger" onClick=${remove}>Usuń ten projekt</button>
        </div>`}
      </div>
      <span class="top__history">
        <button type="button" class="btn is--ghost" title="Cofnij (Cmd+Z)" disabled=${!undoStack.current.length} onClick=${undo}>↶</button>
        <button type="button" class="btn is--ghost" title="Przywróć (Cmd+Shift+Z)" disabled=${!redoStack.current.length} onClick=${redo}>↷</button>
      </span>
      <span class="top__status">${status}</span>
      <span class="top__actions">
        ${CAN_FOLDER
          ? folder
            ? folder.ok
              ? html`<span class="saved" title="Każda zmiana zapisuje się też na dysku">Folder: ${folder.name} ✓</span>`
              : html`<button type="button" class="btn is--warn" onClick=${resumeFolder}>Wznów zapis do folderu „${folder.name}”</button>`
            : html`<button type="button" class="btn is--ghost" onClick=${linkFolder} title="Każda zmiana zapisze się też w wybranym folderze na dysku">Zapisuj w folderze…</button>`
          : html`<span class=${`saved${stale ? " is--warn" : ""}`} title="Safari nie pozwala zapisywać prosto do folderu — rób backup na dysk">Backup: ${ago(meta.lastBackup)}</span>`}
        <label class="btn is--ghost">Wczytaj backup<input type="file" accept=".khorei,.zip" hidden onChange=${(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) restore(f); }} /></label>
        <button type="button" class="btn is--ghost" onClick=${backup}>Backup na dysk</button>
        <button type="button" class="btn is--primary" onClick=${exportZip}>Eksport ZIP ↓</button>
      </span>
    </header>
    <nav class="nav">
      <button type="button" class=${view === "brand" ? "is--on" : ""} onClick=${() => { setView("brand"); setPage("index"); }}>Marka i ustawienia</button>
      <span class="nav__label">Rozdziały</span>
      <ol>${site.chapters.map((c, i) => html`<li class=${`${view === c.id ? "is--on" : ""}${navOver === i ? " is--over" : ""}`} draggable="true"
        onDragStart=${(e) => { e.dataTransfer.setData("kh/chapters", String(i)); e.dataTransfer.effectAllowed = "move"; }}
        onDragOver=${(e) => { if (e.dataTransfer.types.includes("kh/chapters")) { e.preventDefault(); setNavOver(i); } }}
        onDragLeave=${() => setNavOver(null)}
        onDrop=${(e) => { const from = e.dataTransfer.getData("kh/chapters"); setNavOver(null); if (from !== "") { e.preventDefault(); update((p) => moveTo(p.chapters, Number(from), i)); } }}>
        <button type="button" onClick=${() => { setView(c.id); setPage(c.id); }}><span>${c.num}</span>${c.title || "Bez tytułu"}<em>${single ? "" : c.sections.length || ""}</em></button>
        <span class="nav__tools">
          <button type="button" title="Duplikuj rozdział" onClick=${() => { const nc = freshIds(project.chapters[i]); nc.title = `${nc.title} (kopia)`; nc.slug = ""; nc.slugLocked = false; update((p) => { p.chapters.splice(i + 1, 0, nc); }); setView(nc.id); setPage(nc.id); }}>⧉</button>
          ${i > 0 && html`<button type="button" title="W górę" onClick=${() => update((p) => move(p.chapters, i, -1))}>↑</button>`}
          ${i < site.chapters.length - 1 && html`<button type="button" title="W dół" onClick=${() => update((p) => move(p.chapters, i, 1))}>↓</button>`}
          <button type="button" title="Usuń" onClick=${() => { if (confirm(`Usunąć rozdział „${c.title}”?`)) { update((p) => { p.chapters.splice(i, 1); }); setView("brand"); } }}>✕</button>
        </span>
      </li>`)}</ol>
      <button type="button" class="btn is--add" onClick=${() => { const nc = newChapter(); update((p) => { p.chapters.push(nc); }); setView(nc.id); setPage(nc.id); }}>+ Dodaj rozdział</button>
    </nav>
    <main class="panel">
      ${view === "brand" || !chapter
        ? html`<${BrandForm} b=${project.brand} ctx=${ctx} set=${(fn) => update((p) => fn(p.brand))} />`
        : html`<${ChapterForm} key=${chapter.id + (single ? "s" : "m")} single=${single} c=${chapter} num=${site.chapters[chapterIndex].num} ctx=${ctx}
            onFocus=${setFocus} select=${select} set=${(fn) => update((p) => { fn(p.chapters[chapterIndex]); })} />`}
    </main>
    <${Preview} project=${project} page=${page} urls=${urls} focus=${focus} studio=${studio}
      onSelect=${(sel) => {
        const c = project.chapters.find((ch) => (ch.sections || []).some((x) => x.id === sel.section));
        if (!c) return;
        setView(c.id); if (!single) setPage(c.id);
        setSelect({ ...sel, n: Date.now() });
      }}
      setPage=${(slug) => { const c = site.chapters.find((x) => x.slug === slug); setPage(c ? c.id : "index"); setView(c ? c.id : "brand"); }} />
  </div>`;
}

render(html`<${App} />`, document.getElementById("app"));
