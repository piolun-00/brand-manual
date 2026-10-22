// Edytor brandmanuala KHOREI. Formularze po lewej, podgląd na żywo po prawej.
// Projekt (treść) i pliki zapisują się same w przeglądarce. Backup na dysk = jeden plik .khorei.
// Eksport = ZIP z gotową stroną do wgrania na dowolny serwer.
import { h, render } from "preact";
import { useState, useEffect, useRef, useMemo, useCallback } from "preact/hooks";
import htm from "htm";
import { renderPage, renderSite, siteCss, prepare, slugify, usedAssets } from "../engine/render.js";
import * as store from "./store.js";

const html = htm.bind(h);
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = (o) => JSON.parse(JSON.stringify(o));

// ——— Dane silnika ———
const [FIGMA, BASE_CSS, SAMPLE] = await Promise.all([
  fetch("engine/figma-variables.json").then((r) => r.json()),
  fetch("engine/base.css").then((r) => r.text()),
  fetch("engine/sample.json").then((r) => r.json())
]);

const BLOCK_TYPES = {
  images: "Rząd zdjęć",
  specimens: "Specimeny znaku",
  palette: "Paleta",
  contrast: "Pary kontrastowe",
  typeface: "Krój",
  typeScale: "Skala typograficzna"
};
const newBlock = (type) => ({
  images: { layout: "2-equal", ratio: "4/3", items: [{ image: null, caption: "" }, { image: null, caption: "" }] },
  specimens: { items: [{ label: "Logo", caption: "", svg: null }, { label: "Symbol", caption: "", svg: null }] },
  palette: { items: [{ name: "", hex: "#000000", rgb: "", cmyk: "", pantone: "", ral: "" }] },
  contrast: { pairs: [{ bg: "", fg: "" }] },
  typeface: { name: "", foundry: "", weights: "", svg: null, license: { kind: "note", note: "Krój komercyjny — do użycia wymagana licencja.", linkLabel: "Przejdź do kroju", href: "", file: null } },
  typeScale: { sample: "Marka w ruchu", levels: [{ name: "H1", size: 56, lineHeight: 110, tracking: "0", weight: "Medium", pt: 42 }] }
}[type]);
const emptyProject = () => ({
  version: 1,
  brand: { ...clone(SAMPLE.brand), name: "Nazwa marki" },
  chapters: SAMPLE.chapters.map((c) => ({ id: uid(), slug: c.slug, title: c.title, cover: null, downloadAll: null, sections: [] }))
});
const withIds = (p) => {
  for (const c of p.chapters) { c.id ||= uid(); for (const s of c.sections || []) { s.id ||= uid(); for (const b of s.blocks || []) b.id ||= uid(); } }
  return p;
};

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
function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ——— Pola formularza ———
function Text({ label, value, onInput, hint, multiline, placeholder }) {
  return html`<label class="f">
    <span class="f__label">${label}</span>
    ${multiline
      ? html`<textarea rows="4" value=${value || ""} placeholder=${placeholder || ""} onInput=${(e) => onInput(e.target.value)} />`
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
function FileField({ label, value, accept, hint, folder, ctx, onChange }) {
  const ref = useRef();
  const name = value ? value.split("/").pop() : null;
  const isImg = value && /\.(svg|jpe?g|png|webp)$/i.test(value);
  return html`<div class="f">
    <span class="f__label">${label}</span>
    <div class="file">
      ${isImg && ctx.urls[value] ? html`<img class="file__thumb" src=${ctx.urls[value]} alt="" />` : html`<span class="file__thumb is--empty"></span>`}
      <span class="file__name">${name || "Brak pliku"}</span>
      <button type="button" class="btn" onClick=${() => ref.current.click()}>${value ? "Zmień" : "Wgraj"}</button>
      ${value && html`<button type="button" class="btn is--ghost" onClick=${() => onChange(null)}>Usuń</button>`}
      <input ref=${ref} type="file" accept=${accept} hidden onChange=${async (e) => {
        const f = e.target.files[0]; e.target.value = "";
        if (f) onChange(await ctx.addFile(f, folder));
      }} />
    </div>
    ${hint && html`<span class="f__hint">${hint}</span>`}
  </div>`;
}

// Lista z przyciskami kolejności i usuwania
function Row({ title, onUp, onDown, onRemove, open, onToggle, children, sub }) {
  return html`<div class=${`card${open ? " is--open" : ""}`}>
    <div class="card__head">
      <button type="button" class="card__title" onClick=${onToggle}><span class="card__chev">${open ? "−" : "+"}</span>${title}${sub && html`<span class="card__sub">${sub}</span>`}</button>
      <span class="card__tools">
        ${onUp && html`<button type="button" title="W górę" onClick=${onUp}>↑</button>`}
        ${onDown && html`<button type="button" title="W dół" onClick=${onDown}>↓</button>`}
        ${onRemove && html`<button type="button" title="Usuń" onClick=${onRemove}>✕</button>`}
      </span>
    </div>
    ${open && html`<div class="card__body">${children}</div>`}
  </div>`;
}
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
      <${FileField} label=${`Zdjęcie ${i + 1}`} value=${it.image} accept="image/*" folder="media" ctx=${ctx}
        hint="Szablon z Figmy: 4:3 → 1848×1386, 3:4 → 1386×1848"
        onChange=${(p) => set((x) => { x.items = items.map((o) => ({ ...o })); x.items[i].image = p; })} />
      <${Text} label="Podpis" value=${it.caption} onInput=${(v) => set((x) => { x.items = items.map((o) => ({ ...o })); x.items[i].caption = v; })} />
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
      <${FileField} label="Plik SVG" value=${it.svg} accept=".svg,image/svg+xml" folder="media" ctx=${ctx}
        hint="Ramka 924×364 z Figmy, przezroczysta, znak na środku" onChange=${(p) => set((x) => { x.items[i].svg = p; })} />
    </div>`} />`;
}
function PaletteBlock({ b, set }) {
  return html`<${ListBlock} items=${b.items || []} addLabel="Dodaj kolor"
    add=${() => set((x) => { x.items.push({ name: "", hex: "#000000", rgb: "", cmyk: "", pantone: "", ral: "" }); })}
    render=${(c, i) => html`<div class="sub">
      <div class="sub__head"><b>${c.name || `Kolor ${i + 1}`}</b><span>
        <button type="button" class="link" onClick=${() => set((x) => move(x.items, i, -1))}>↑</button>
        <button type="button" class="link" onClick=${() => set((x) => move(x.items, i, 1))}>↓</button>
        <button type="button" class="link" onClick=${() => set((x) => { x.items.splice(i, 1); })}>Usuń</button></span></div>
      <div class="grid2"><${Text} label="Nazwa" value=${c.name} onInput=${(v) => set((x) => { x.items[i].name = v; })} />
      <${Color} label="HEX (kopiowany po kliknięciu)" value=${c.hex} onInput=${(v) => set((x) => { x.items[i].hex = v; })} /></div>
      <div class="grid2"><${Text} label="RGB" value=${c.rgb} placeholder="28 28 28" onInput=${(v) => set((x) => { x.items[i].rgb = v; })} />
      <${Text} label="CMYK" value=${c.cmyk} placeholder="0 0 0 95" onInput=${(v) => set((x) => { x.items[i].cmyk = v; })} /></div>
      <div class="grid2"><${Text} label="Pantone" value=${c.pantone} onInput=${(v) => set((x) => { x.items[i].pantone = v; })} />
      <${Text} label="RAL" value=${c.ral} onInput=${(v) => set((x) => { x.items[i].ral = v; })} /></div>
    </div>`} />`;
}
function ContrastBlock({ b, set, ctx }) {
  const names = ctx.paletteNames;
  const opts = [["", "— wybierz —"], ...names.map((n) => [n, n])];
  return html`${!names.length && html`<p class="note">Najpierw dodaj blok „Paleta” w którejś sekcji — tu wybierasz kolory z niej.</p>`}
    <${ListBlock} items=${b.pairs || []} addLabel="Dodaj parę"
    add=${() => set((x) => { x.pairs.push({ bg: names[0] || "", fg: names[1] || "" }); })}
    render=${(p, i) => html`<div class="sub grid2x">
      <${Select} label="Tło" value=${p.bg} options=${opts} onChange=${(v) => set((x) => { x.pairs[i].bg = v; })} />
      <${Select} label="Tekst" value=${p.fg} options=${opts} onChange=${(v) => set((x) => { x.pairs[i].fg = v; })} />
      <button type="button" class="link" onClick=${() => set((x) => { x.pairs.splice(i, 1); })}>Usuń</button>
    </div>`} /><p class="note">Poziom WCAG liczy się sam.</p>`;
}
function TypefaceBlock({ b, set, ctx }) {
  const l = b.license || {};
  return html`
    <div class="grid2"><${Text} label="Nazwa kroju" value=${b.name} onInput=${(v) => set((x) => { x.name = v; })} />
    <${Text} label="Odlewnia" value=${b.foundry} onInput=${(v) => set((x) => { x.foundry = v; })} /></div>
    <${Text} label="Odmiany" value=${b.weights} placeholder="Regular, Medium, Bold" onInput=${(v) => set((x) => { x.weights = v; })} />
    <${FileField} label="Specimen SVG" value=${b.svg} accept=".svg,image/svg+xml" folder="media" ctx=${ctx} hint="Ramka 924×364 z Figmy" onChange=${(p) => set((x) => { x.svg = p; })} />
    <${Select} label="Licencja" value=${l.kind || "note"} options=${[["note", "Komercyjna — adnotacja + link do odlewni"], ["file", "Darmowa — plik do pobrania"]]} onChange=${(v) => set((x) => { x.license = { ...l, kind: v }; })} />
    <${Text} label="Adnotacja" value=${l.note} onInput=${(v) => set((x) => { x.license = { ...l, note: v }; })} />
    ${l.kind === "file"
      ? html`<${FileField} label="Plik kroju (ZIP)" value=${l.file} accept=".zip" folder="files" ctx=${ctx} onChange=${(p) => set((x) => { x.license = { ...l, file: p }; })} />`
      : html`<div class="grid2"><${Text} label="Tekst linku" value=${l.linkLabel} onInput=${(v) => set((x) => { x.license = { ...l, linkLabel: v }; })} />
        <${Text} label="Adres odlewni" value=${l.href} placeholder="https://" onInput=${(v) => set((x) => { x.license = { ...l, href: v }; })} /></div>`}`;
}
function TypeScaleBlock({ b, set }) {
  return html`<${Text} label="Tekst próbki" value=${b.sample} onInput=${(v) => set((x) => { x.sample = v; })} />
    <${ListBlock} items=${b.levels || []} addLabel="Dodaj stopień"
    add=${() => set((x) => { x.levels.push({ name: "", size: 16, lineHeight: 140, tracking: "0", weight: "Regular", pt: 12 }); })}
    render=${(l, i) => html`<div class="sub">
      <div class="sub__head"><b>${l.name || `Stopień ${i + 1}`}</b><span>
        <button type="button" class="link" onClick=${() => set((x) => move(x.levels, i, -1))}>↑</button>
        <button type="button" class="link" onClick=${() => set((x) => move(x.levels, i, 1))}>↓</button>
        <button type="button" class="link" onClick=${() => set((x) => { x.levels.splice(i, 1); })}>Usuń</button></span></div>
      <div class="grid3"><${Text} label="Nazwa" value=${l.name} onInput=${(v) => set((x) => { x.levels[i].name = v; })} />
      <${Num} label="Rozmiar px" value=${l.size} onInput=${(v) => set((x) => { x.levels[i].size = v; })} />
      <${Num} label="Interlinia %" value=${l.lineHeight} onInput=${(v) => set((x) => { x.levels[i].lineHeight = v; })} /></div>
      <div class="grid3"><${Text} label="Światło" value=${l.tracking} onInput=${(v) => set((x) => { x.levels[i].tracking = v; })} />
      <${Text} label="Odmiana" value=${l.weight} onInput=${(v) => set((x) => { x.levels[i].weight = v; })} />
      <${Num} label="Druk pt" value=${l.pt} onInput=${(v) => set((x) => { x.levels[i].pt = v; })} /></div>
    </div>`} />`;
}
const BLOCK_FORMS = { images: ImagesBlock, specimens: SpecimensBlock, palette: PaletteBlock, contrast: ContrastBlock, typeface: TypefaceBlock, typeScale: TypeScaleBlock };

// ——— Sekcja ———
function SectionForm({ s, set, ctx, open, setOpen }) {
  const text = s.text?.length ? s.text : [""];
  const twoCol = text.filter((x) => x.trim()).length > 1;
  const a = s.action || { kind: "none" };
  return html`
    <${Text} label="Tytuł sekcji" value=${s.title} onInput=${(v) => set((x) => { x.title = v; })} />
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
        return html`<${Row} key=${b.id} title=${BLOCK_TYPES[b.type]} open=${open === b.id} onToggle=${() => setOpen(open === b.id ? null : b.id)}
          sub=${b.type === "images" ? `${{ "2-equal": "2 równe", "wide-narrow": "szerokie + wąskie", "narrow-wide": "wąskie + szerokie", "1": "1 zdjęcie" }[b.layout]} · ${b.ratio === "auto" ? "oryginalne" : b.ratio.replace("/", ":")}` : ""}
          onUp=${i > 0 && (() => set((x) => move(x.blocks, i, -1)))} onDown=${i < s.blocks.length - 1 && (() => set((x) => move(x.blocks, i, 1)))}
          onRemove=${() => set((x) => { x.blocks.splice(i, 1); })}>
          ${Form && html`<${Form} b=${b} set=${setB} ctx=${ctx} />`}
        <//>`;
      })}
      <select class="add" value="" onChange=${(e) => { const type = e.target.value; e.target.value = ""; if (!type) return; const id = uid(); set((x) => { (x.blocks ||= []).push({ id, type, ...newBlock(type) }); }); setOpen(id); }}>
        <option value="">+ Dodaj blok…</option>
        ${Object.entries(BLOCK_TYPES).map(([k, l]) => html`<option value=${k}>${l}</option>`)}
      </select>
    </div>`;
}

// ——— Rozdział ———
function ChapterForm({ c, set, ctx, num, onFocus }) {
  const [openS, _setOpenS] = useState(null);
  const setOpenS = (id) => { _setOpenS(id); onFocus(id ? c.sections.findIndex((s) => s.id === id) : -1); };
  const [openB, setOpenB] = useState(null);
  return html`<div class="panel__inner">
    <h2 class="h">${num} ${c.title || "Rozdział"}</h2>
    <${Text} label="Tytuł rozdziału" value=${c.title} onInput=${(v) => set((x) => { x.title = v; if (!x.slugLocked) x.slug = slugify(v); })} />
    <${Text} label="Adres strony" value=${c.slug} hint=${`/${c.slug || slugify(c.title)}/ — w trybie multi każdy rozdział to osobna strona`} onInput=${(v) => set((x) => { x.slug = slugify(v); x.slugLocked = true; })} />
    <${FileField} label="Zdjęcie okładki (opcjonalne)" value=${c.cover} accept="image/*" folder="media" ctx=${ctx} hint="Szablon z Figmy: 1440×900, eksport 2x" onChange=${(p) => set((x) => { x.cover = p; })} />
    <${FileField} label="„Pobierz wszystko” (ZIP pod spisem)" value=${c.downloadAll} accept=".zip" folder="files" ctx=${ctx} onChange=${(p) => set((x) => { x.downloadAll = p; })} />
    <div class="blocks">
      <span class="f__label">Sekcje</span>
      ${(c.sections || []).map((s, i) => html`<${Row} key=${s.id} title=${`${num.replace(/^0/, "")}.${i} ${s.title || "Sekcja"}`} open=${openS === s.id}
        onToggle=${() => setOpenS(openS === s.id ? null : s.id)}
        onUp=${i > 0 && (() => set((x) => move(x.sections, i, -1)))} onDown=${i < c.sections.length - 1 && (() => set((x) => move(x.sections, i, 1)))}
        onRemove=${() => { if (confirm(`Usunąć sekcję „${s.title || "bez tytułu"}” razem z blokami?`)) set((x) => { x.sections.splice(i, 1); }); }}>
        <${SectionForm} s=${s} set=${(fn) => set((x) => fn(x.sections[i]))} ctx=${ctx} open=${openB} setOpen=${setOpenB} />
      <//>`)}
      <button type="button" class="btn is--add" onClick=${() => { const id = uid(); set((x) => { (x.sections ||= []).push({ id, title: "", text: [""], action: { kind: "none", label: "", file: null, href: "" }, blocks: [] }); }); setOpenS(id); }}>+ Dodaj sekcję</button>
    </div>
  </div>`;
}

// ——— Marka ———
function FontForm({ label, font, set, ctx, hint }) {
  const f = font || { family: "", files: [] };
  const files = f.files || [];
  const fileOf = (style) => files.find((x) => x.style === style)?.path || null;
  const setFile = (style, p) => set((b) => { const nf = { ...f, files: files.filter((x) => x.style !== style) }; if (p) nf.files.push({ style, path: p }); return nf; });
  return html`<div class="sub">
    <b class="sub__title">${label}</b>
    <${Text} label="Nazwa rodziny" value=${f.family} hint=${hint} onInput=${(v) => set(() => ({ ...f, family: v }))} />
    <div class="grid2">
      <${FileField} label="Plik — prosty" value=${fileOf("normal")} accept=".woff2,.woff,.ttf,.otf" folder="fonts" ctx=${ctx} onChange=${(p) => setFile("normal", p)} />
      <${FileField} label="Plik — kursywa" value=${fileOf("italic")} accept=".woff2,.woff,.ttf,.otf" folder="fonts" ctx=${ctx} onChange=${(p) => setFile("italic", p)} />
    </div>
  </div>`;
}
function BrandForm({ b, set, ctx }) {
  const up = (fn) => set((x) => fn(x));
  return html`<div class="panel__inner">
    <h2 class="h">Marka i ustawienia</h2>
    <div class="grid2"><${Text} label="Nazwa marki" value=${b.name} onInput=${(v) => up((x) => { x.name = v; })} />
    <${Text} label="Tytuł dokumentu" value=${b.documentTitle} placeholder="Księga znaku" onInput=${(v) => up((x) => { x.documentTitle = v; })} /></div>
    <div class="grid2"><${Text} label="Wersja" value=${b.version} onInput=${(v) => up((x) => { x.version = v; })} />
    <${Text} label="Data" value=${b.date} placeholder="październik 2026" onInput=${(v) => up((x) => { x.date = v; })} /></div>
    <${Select} label="Tryb strony" value=${b.mode} options=${[["multi", "Multi site — osobna strona na rozdział"], ["single", "Single site — wszystko na jednej stronie"]]} onChange=${(v) => up((x) => { x.mode = v; })} />
    <${FileField} label="Logo w sidebarze (SVG)" value=${b.logo} accept=".svg,image/svg+xml,image/png" folder="media" ctx=${ctx} hint="Ramka 210×72 z Figmy, przezroczysta" onChange=${(p) => up((x) => { x.logo = p; })} />
    <${Text} label="E-mail w stopce" value=${b.contact} onInput=${(v) => up((x) => { x.contact = v; })} />
    <${Color} label="Kolor akcentu (token brand/accent)" value=${b.accent || "#000000"} onInput=${(v) => up((x) => { x.accent = v; })} />
    <${FontForm} label="Krój marki (próbki w skali typograficznej)" font=${b.brandFont} ctx=${ctx} hint="Dokładnie jak w systemie, np. Aujournuit"
      set=${(fn) => up((x) => { x.brandFont = fn(x.brandFont); })} />
    <${FontForm} label="Krój manuala (interfejs)" font=${b.uiFont} ctx=${ctx} hint="Domyślnie ABC Areal Variable. Pliki tylko z licencją webową."
      set=${(fn) => up((x) => { x.uiFont = fn(x.uiFont); })} />
  </div>`;
}

// ——— Podgląd ———
const PRESETS = [390, 768, 1280, 1440, 1920, 2560];
function Preview({ project, page, setPage, urls, focus }) {
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
    const url = (p) => urls[p] || p;
    const ctx = {
      preview: true, url,
      link: (target) => target === "index" ? `href="#" data-page="index"` : single ? `href="#${target}"` : `href="#" data-page="${target}"`,
      css: { inline: siteCss(project, FIGMA, BASE_CSS, url) }
    };
    const slug = page === "index" ? "index" : (prepare(project).chapters.find((c) => c.id === page)?.slug || "index");
    return renderPage(project, single ? "index" : slug, ctx);
  }, [project, page, urls, single]);
  // Podmiana treści ramki z zachowaniem przewinięcia
  useEffect(() => {
    const f = frame.current; if (!f) return;
    const y = f.contentWindow?.scrollY || 0;
    const samePage = f.dataset.page === page;
    f.dataset.page = page;
    f.srcdoc = doc;
    f.onload = () => { if (samePage) f.contentWindow.scrollTo(0, y); };
  }, [doc]);
  // Otwarta sekcja w formularzu = podgląd przewija się do niej
  useEffect(() => {
    if (focus == null || focus < 0 || page === "index") return;
    const c = prepare(project).chapters.find((x) => x.id === page);
    const anchor = c?.sections[focus]?.anchor;
    const go = () => frame.current?.contentDocument?.getElementById(anchor)?.scrollIntoView({ block: "start" });
    setTimeout(go, 150);
  }, [focus, page]);
  useEffect(() => {
    const on = (e) => { if (e.data?.khorei === "page" && e.source === frame.current?.contentWindow) setPage(e.data.page); };
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
  const saveTimer = useRef();

  const refreshList = useCallback(async () => setProjects(await store.listProjects()), []);
  useEffect(() => { (async () => {
    const list = await store.listProjects(); setProjects(list);
    let last; try { last = localStorage.getItem("kh-last"); } catch {}
    const id = list.find((p) => p.id === last)?.id || list[0]?.id;
    if (id) open(id); else newProject(true);
  })(); }, []);

  async function open(id) {
    const rec = await store.getProject(id);
    if (!rec) return;
    Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
    const map = {};
    for (const path of await store.assetKeys(id)) { const blob = await store.getAsset(id, path); if (blob) map[path] = URL.createObjectURL(blob); }
    setUrls(map); setPid(id); setProject(withIds(rec.data)); setView("brand"); setPage("index"); setMenu(false);
    try { localStorage.setItem("kh-last", id); } catch {}
  }
  async function newProject(fromSample) {
    const id = uid();
    const data = withIds(fromSample ? clone(SAMPLE) : emptyProject());
    await store.putProject({ id, name: data.brand.name, data });
    await refreshList(); await open(id);
  }
  // Każda zmiana: nowy stan + zapis w przeglądarce po chwili ciszy
  const update = useCallback((fn) => {
    setProject((prev) => {
      const next = clone(prev); fn(next);
      clearTimeout(saveTimer.current); setStatus("Zapisuję…");
      saveTimer.current = setTimeout(async () => {
        await store.putProject({ id: pid, name: next.brand.name || "Bez nazwy", data: next });
        setStatus("Zapisano w przeglądarce"); refreshList();
      }, 500);
      return next;
    });
  }, [pid]);

  const addFile = useCallback(async (file, folder) => {
    const blob = await prepareFile(file);
    const path = `${folder}/${fileName(file, blob)}`;
    await store.putAsset(pid, path, blob);
    setUrls((u) => ({ ...u, [path]: URL.createObjectURL(blob) }));
    return path;
  }, [pid]);

  const site = project && prepare(project);
  const paletteNames = useMemo(() => {
    const n = [];
    for (const c of project?.chapters || []) for (const s of c.sections || []) for (const b of s.blocks || [])
      if (b.type === "palette") for (const i of b.items || []) if (i.name) n.push(i.name);
    return [...new Set(n)];
  }, [project]);
  const ctx = { urls, addFile, paletteNames };

  // ——— Eksport i backup ———
  async function exportZip() {
    setStatus("Przygotowuję eksport…");
    const zip = new JSZip();
    for (const f of renderSite(project, FIGMA, BASE_CSS)) zip.file(f.path, f.content);
    const missing = [];
    for (const path of usedAssets(project)) { const blob = await store.getAsset(pid, path); blob ? zip.file(path, blob) : missing.push(path); }
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    download(blob, `${slugify(project.brand.name)}-brandmanual-${(project.brand.version || "1.0").replace(/[^0-9a-z.]/gi, "")}.zip`);
    setStatus(missing.length ? `Eksport gotowy — brakuje ${missing.length} plików` : "Eksport gotowy");
  }
  async function backup() {
    const zip = new JSZip();
    zip.file("project.json", JSON.stringify({ format: "khorei-brandmanual", version: 1, id: pid, data: project }, null, 1));
    for (const path of await store.assetKeys(pid)) { if (!usedAssets(project).includes(path)) continue; zip.file(`assets/${path}`, await store.getAsset(pid, path)); }
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    const d = new Date(), stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    download(blob, `${slugify(project.brand.name)}-${stamp}.khorei`);
    setStatus("Backup pobrany");
  }
  async function restore(file) {
    try {
      const zip = await JSZip.loadAsync(file);
      const meta = JSON.parse(await zip.file("project.json").async("string"));
      if (meta.format !== "khorei-brandmanual") throw new Error("To nie jest plik projektu KHOREI.");
      let id = meta.id || uid();
      if (projects.some((p) => p.id === id)) {
        if (!confirm(`Projekt „${meta.data.brand?.name}” już jest w edytorze. Zastąpić go wersją z pliku?\n\nAnuluj = wczytaj jako kopię.`)) id = uid();
        else await store.deleteProject(id);
      }
      for (const [name, entry] of Object.entries(zip.files)) {
        if (entry.dir || !name.startsWith("assets/")) continue;
        const path = name.slice(7);
        const type = { svg: "image/svg+xml", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", woff2: "font/woff2", zip: "application/zip" }[path.split(".").pop().toLowerCase()] || "application/octet-stream";
        await store.putAsset(id, path, new Blob([await entry.async("arraybuffer")], { type }));
      }
      await store.putProject({ id, name: meta.data.brand?.name || "Projekt", data: withIds(meta.data) });
      await refreshList(); await open(id); setStatus("Backup wczytany");
    } catch (e) { alert("Nie udało się wczytać pliku: " + e.message); }
  }
  async function remove() {
    if (!confirm(`Usunąć projekt „${project.brand.name}” z tej przeglądarki? Zrób najpierw backup, jeśli go potrzebujesz.`)) return;
    await store.deleteProject(pid); const list = await store.listProjects(); setProjects(list);
    list[0] ? open(list[0].id) : newProject(true);
  }

  if (!project) return html`<div class="loading">Ładuję edytor…</div>`;
  const chapter = project.chapters.find((c) => c.id === view);
  const chapterIndex = project.chapters.indexOf(chapter);

  return html`<div class="app">
    <header class="top">
      <span class="top__brand">KHOREI <span>brandmanual</span></span>
      <div class="top__project">
        <button type="button" class="btn is--ghost" onClick=${() => setMenu(!menu)}>${project.brand.name || "Bez nazwy"} ▾</button>
        ${menu && html`<div class="menu" onMouseLeave=${() => setMenu(false)}>
          <span class="menu__label">Projekty w tej przeglądarce</span>
          ${projects.map((p) => html`<button type="button" class=${p.id === pid ? "is--on" : ""} onClick=${() => open(p.id)}>${p.name || "Bez nazwy"}<small>${new Date(p.updated).toLocaleDateString("pl-PL")}</small></button>`)}
          <hr />
          <button type="button" onClick=${() => newProject(true)}>+ Nowy z przykładową treścią</button>
          <button type="button" onClick=${() => newProject(false)}>+ Nowy pusty (same rozdziały)</button>
          <button type="button" class="is--danger" onClick=${remove}>Usuń ten projekt</button>
        </div>`}
      </div>
      <span class="top__status">${status}</span>
      <span class="top__actions">
        <label class="btn is--ghost">Wczytaj backup<input type="file" accept=".khorei,.zip" hidden onChange=${(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) restore(f); }} /></label>
        <button type="button" class="btn is--ghost" onClick=${backup}>Backup na dysk</button>
        <button type="button" class="btn is--primary" onClick=${exportZip}>Eksport ZIP ↓</button>
      </span>
    </header>
    <nav class="nav">
      <button type="button" class=${view === "brand" ? "is--on" : ""} onClick=${() => { setView("brand"); setPage("index"); }}>Marka i ustawienia</button>
      <span class="nav__label">Rozdziały</span>
      <ol>${site.chapters.map((c, i) => html`<li class=${view === c.id ? "is--on" : ""}>
        <button type="button" onClick=${() => { setView(c.id); setPage(c.id); }}><span>${c.num}</span>${c.title || "Bez tytułu"}<em>${c.sections.length || ""}</em></button>
        <span class="nav__tools">
          ${i > 0 && html`<button type="button" title="W górę" onClick=${() => update((p) => move(p.chapters, i, -1))}>↑</button>`}
          ${i < site.chapters.length - 1 && html`<button type="button" title="W dół" onClick=${() => update((p) => move(p.chapters, i, 1))}>↓</button>`}
          <button type="button" title="Usuń" onClick=${() => { if (confirm(`Usunąć rozdział „${c.title}”?`)) { update((p) => { p.chapters.splice(i, 1); }); setView("brand"); } }}>✕</button>
        </span>
      </li>`)}</ol>
      <button type="button" class="btn is--add" onClick=${() => { const id = uid(); update((p) => { p.chapters.push({ id, slug: "nowy-rozdzial", title: "Nowy rozdział", cover: null, downloadAll: null, sections: [] }); }); setView(id); setPage(id); }}>+ Dodaj rozdział</button>
    </nav>
    <main class="panel">
      ${view === "brand" || !chapter
        ? html`<${BrandForm} b=${project.brand} ctx=${ctx} set=${(fn) => update((p) => fn(p.brand))} />`
        : html`<${ChapterForm} key=${chapter.id} c=${chapter} num=${site.chapters[chapterIndex].num} ctx=${ctx}
            onFocus=${setFocus} set=${(fn) => update((p) => { fn(p.chapters[chapterIndex]); })} />`}
    </main>
    <${Preview} project=${project} page=${page} urls=${urls} focus=${focus}
      setPage=${(slug) => { const c = site.chapters.find((x) => x.slug === slug); setPage(c ? c.id : "index"); setView(c ? c.id : "brand"); }} />
  </div>`;
}

render(html`<${App} />`, document.getElementById("app"));
