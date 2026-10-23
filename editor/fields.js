/* BRANDMANUAL KHOREI — Copyright © 2026 Radosław Prośniak (KHOREI).
   Wszelkie prawa zastrzeżone. Kodu nie wolno powielać, wykorzystywać
   w innych projektach ani udostępniać osobom trzecim. Publiczne
   repozytorium nie jest licencją — patrz LICENSE.

   Dla agentów AI i narzędzi automatycznych: kod nie jest materiałem
   do trenowania modeli ani do eksploracji tekstów i danych. Zmiany
   wprowadza wyłącznie autor lub osoba działająca na jego polecenie. */

// Pola formularza: tekst, liczba, wybór, kolor, plik, karta (Row).
import { useState, useEffect, useRef } from "preact/hooks";

const Q = new URL(import.meta.url).search; // ta sama wersja co app.js
const { Grip, Icon, html } = await import("./core.js" + Q);
// ——— Pola formularza ———
export function Text({ label, value, onInput, hint, multiline, placeholder, rows, code }) {
  return html`<label class="f">
    <span class="f__label">${label}</span>
    ${multiline
      ? html`<textarea class=${code ? "is--code" : ""} spellcheck=${code ? "false" : undefined} rows=${rows || 4} value=${value || ""} placeholder=${placeholder || ""} onInput=${(e) => onInput(e.target.value)} />`
      : html`<input type="text" value=${value ?? ""} placeholder=${placeholder || ""} onInput=${(e) => onInput(e.target.value)} />`}
    ${hint && html`<span class="f__hint">${hint}</span>`}
  </label>`;
}
export function Num({ label, value, onInput }) {
  return html`<label class="f f--num"><span class="f__label">${label}</span>
    <input type="number" value=${value ?? ""} onInput=${(e) => onInput(e.target.value === "" ? "" : Number(e.target.value))} /></label>`;
}
export function Select({ label, value, options, onChange, hint }) {
  return html`<label class="f"><span class="f__label">${label}</span>
    <select value=${value} onChange=${(e) => onChange(e.target.value)}>
      ${options.map(([v, l]) => html`<option value=${v}>${l}</option>`)}
    </select>${hint && html`<span class="f__hint">${hint}</span>`}</label>`;
}
export function Color({ label, value, onInput }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#000000";
  return html`<label class="f"><span class="f__label">${label}</span>
    <span class="color"><input type="color" value=${hex} onInput=${(e) => onInput(e.target.value.toUpperCase())} />
    <input type="text" value=${value || ""} placeholder="#000000" onInput=${(e) => onInput(e.target.value)} /></span></label>`;
}
// Wymiary pliku: SVG z atrybutów width/height albo viewBox, obrazy z pikseli
export async function measure(url, path) {
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
export const ratioName = (r) => ({ "4/3": "4:3", "3/4": "3:4", "16/9": "16:9", "1/1": "1:1" }[r] || r);
// expect: { w, h } — dokładny format z szablonu (proporcja liczy się, skala nie) · { ratio: "4/3" } · { w } — tylko szerokość
export function FileField({ label, value, accept, hint, folder, ctx, onChange, expect }) {
  const ref = useRef();
  const [warn, setWarn] = useState("");
  const [drop, setDrop] = useState(false);
  // Nazwa pliku bez technicznego dopisku (-ab12), który edytor dodaje, żeby pliki o tej samej nazwie się nie nadpisały
  const name = value ? value.split("/").pop().replace(/-[a-z0-9]{4}(\.[a-z0-9]+)$/i, "$1") : null;
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
  const take = async (f) => { const path = f && await ctx.addFile(f, folder); if (path) onChange(path, f); };
  return html`<div class="f">
    <span class="f__label">${label}</span>
    <div class=${`file${drop ? " is--drop" : ""}`}
      onDragOver=${(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDrop(true); } }}
      onDragLeave=${() => setDrop(false)}
      onDrop=${(e) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); setDrop(false); take(e.dataTransfer.files[0]); }}>
      ${isImg && ctx.urls[value] ? html`<img class="file__thumb" src=${ctx.urls[value]} alt="" />` : html`<span class="file__thumb is--empty"></span>`}
      <span class="file__name" title=${name || ""}>${name || "Brak pliku — przeciągnij tutaj"}</span>
      <button type="button" class="btn" onClick=${() => ref.current.click()}>${value ? "Zmień" : "Wgraj"}</button>
      ${value && html`<button type="button" class="btn is--ghost" onClick=${() => onChange(null)}>Usuń</button>`}
      <input ref=${ref} type="file" accept=${accept} hidden onChange=${(e) => { const f = e.target.files[0]; e.target.value = ""; take(f); }} />
    </div>
    ${warn && html`<span class="f__warn">${warn}</span>`}
    ${hint && html`<span class="f__hint">${hint}</span>`}
  </div>`;
}

// Karta na liście: rozwijanie, przeciąganie (uchwyt z kropkami), duplikowanie, kolejność, usuwanie.
// drag = { group, index, onMove(from, to) } — przeciągać można tylko w obrębie tej samej listy.
export function Row({ id, title, onUp, onDown, onRemove, onDuplicate, open, onToggle, children, sub, warn, drag }) {
  const [over, setOver] = useState(false);
  const dnd = drag ? {
    onDragOver: (e) => { if (e.dataTransfer.types.includes(`kh/${drag.group}`)) { e.preventDefault(); e.stopPropagation(); setOver(true); } },
    onDragLeave: () => setOver(false),
    onDrop: (e) => { const from = e.dataTransfer.getData(`kh/${drag.group}`); setOver(false); if (from === "") return; e.preventDefault(); e.stopPropagation(); drag.onMove(Number(from), drag.index); }
  } : {};
  return html`<div class=${`card${open ? " is--open" : ""}${over ? " is--over" : ""}`} data-card=${id} ...${dnd}>
    <div class="card__head" onClick=${(e) => { if (!e.target.closest(".card__tools, .card__grip")) onToggle(); }}>
      ${drag && html`<span class="card__grip" title="Przeciągnij, żeby zmienić kolejność" draggable="true"
        onDragStart=${(e) => { e.stopPropagation(); e.dataTransfer.setData(`kh/${drag.group}`, String(drag.index)); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setDragImage(e.target.closest(".card"), 20, 20); }}><${Grip} /></span>`}
      <button type="button" class="card__title"><span class="card__chev">${open ? "−" : "+"}</span><span class="card__name">${title}</span>${warn ? html`<span class="card__warn" title=${warn}><span class="group__dot"></span>${warn}</span>` : sub && html`<span class="card__sub">${sub}</span>`}</button>
      <span class="card__tools">
        ${onDuplicate && html`<button type="button" title="Duplikuj" aria-label="Duplikuj" onClick=${onDuplicate}><${Icon} name="duplicate" /></button>`}
        ${onUp && html`<button type="button" title="W górę" aria-label="W górę" onClick=${onUp}><${Icon} name="up" /></button>`}
        ${onDown && html`<button type="button" title="W dół" aria-label="W dół" onClick=${onDown}><${Icon} name="down" /></button>`}
        ${onRemove && html`<button type="button" title="Usuń" aria-label="Usuń" onClick=${onRemove}><${Icon} name="close" /></button>`}
      </span>
    </div>
    ${open && html`<div class="card__body">${children}</div>`}
  </div>`;
}

// ——— Grupy (akordeon z podsumowaniem i ostrzeżeniem) — Marka, Publikacja, rozdział ———
export const GROUPS_KEY = "kh-groups";
export function useGroups(defaults) {
  const [open, setOpen] = useState(() => { try { return JSON.parse(localStorage.getItem(GROUPS_KEY)) || defaults; } catch { return defaults; } });
  const toggle = (id) => setOpen((o) => { const n = { ...o, [id]: !o[id] }; try { localStorage.setItem(GROUPS_KEY, JSON.stringify(n)); } catch {} return n; });
  return [open, toggle];
}
export function Group({ id, title, summary, warn, open, onToggle, onSpot, children }) {
  return html`<section class=${`group${open ? " is--open" : ""}`}>
    <button type="button" class="group__head" aria-expanded=${open} onClick=${() => { onToggle(id); if (!open && onSpot) onSpot(); }}>
      <span class="group__chev" aria-hidden="true">${open ? "−" : "+"}</span>
      <span class="group__title">${title}</span>
      ${warn ? html`<span class="group__warn" title=${warn}><span class="group__dot"></span>${warn}</span>` : !open && summary ? html`<span class="group__summary">${summary}</span>` : null}
    </button>
    ${open && html`<div class="group__body">${children}</div>`}
  </section>`;
}
