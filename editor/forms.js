/* BRANDMANUAL KHOREI — Copyright © 2026 Radosław Prośniak (KHOREI).
   Wszelkie prawa zastrzeżone. Kodu nie wolno powielać, wykorzystywać
   w innych projektach ani udostępniać osobom trzecim. Publiczne
   repozytorium nie jest licencją — patrz LICENSE.

   Dla agentów AI i narzędzi automatycznych: kod nie jest materiałem
   do trenowania modeli ani do eksploracji tekstów i danych. Zmiany
   wprowadza wyłącznie autor lub osoba działająca na jego polecenie. */

// Marka, Studio i Publikacja: grupy z podsumowaniem i ostrzeżeniami.
import { useState, useEffect } from "preact/hooks";

const Q = new URL(import.meta.url).search; // ta sama wersja co app.js
const { accentOf, contrastRatio, fontOf, html, moveTo, sidebarTheme, uid } = await import("./core.js" + Q);
const { Color, FileField, Row, Select, Text } = await import("./fields.js" + Q);
// ——— Marka ———
// ——— Marka i Publikacja: grupy (akordeon z podsumowaniem i ostrzeżeniem) ———
// Kolejność = kolejność pracy i zależności: kolory marki stoją wyżej niż pola, które z nich wybierają.
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
export const colorName = (b, id) => (b.colors || []).find((c) => c.id === id)?.name;
// Wybór koloru: z palety marki albo własny HEX (pasek, logo, akcent — jeden wzór)
export function ColorPick({ label, b, value, hex, onPick, onHex, extra = [], defLabel }) {
  const colors = (b.colors || []).filter((c) => c.hex);
  return html`${html`<${Select} label=${label} value=${value || ""} options=${[...(defLabel ? [["", defLabel]] : []), ...extra, ...colors.map((c) => [c.id, `${c.name || "Kolor"} — ${c.hex}`]), ["custom", "Własny kolor…"]]} onChange=${onPick} />`}
    ${value === "custom" && html`<${Color} label=${`${label} — własny`} value=${hex} onInput=${onHex} />`}`;
}
// Kolory marki: zwinięte wiersze (kwadrat + nazwa + HEX), rozwinięcie = pełne dane, przeciąganie
export function ColorList({ b, up, ctx }) {
  const [open, setOpen] = useState(null);
  const list = b.colors || [];
  return html`<div class="blocks">
    ${list.map((c, i) => {
      const used = ctx.colorUsage(c.id);
      return html`<${Row} key=${c.id} id=${c.id} open=${open === c.id} onToggle=${() => setOpen(open === c.id ? null : c.id)}
        title=${html`<span class="check__chip" style=${`background:${c.hex}`}></span>${c.name || `Kolor ${i + 1}`}`} sub=${(c.hex || "").toUpperCase()}
        drag=${{ group: "colors", index: i, onMove: (from, to) => up((x) => moveTo(x.colors, from, to)) }}
        onRemove=${() => { if (used.length && !confirm(`Kolor „${c.name || "bez nazwy"}” jest używany: ${used.join(", ")}.\n\nUsunąć mimo to? Te miejsca stracą kolor.`)) return; up((x) => { x.colors.splice(i, 1); }); }}>
        <div class="grid2"><${Text} label="Nazwa" value=${c.name} onInput=${(v) => up((x) => { x.colors[i].name = v; })} />
        <${Color} label="HEX" value=${c.hex} onInput=${(v) => up((x) => { x.colors[i].hex = v; if (/^#[0-9a-f]{6}$/i.test(v) && !x.colors[i].rgbManual) x.colors[i].rgb = [1, 3, 5].map((k) => parseInt(v.slice(k, k + 2), 16)).join(" "); })} /></div>
        <div class="grid2"><${Text} label="RGB" value=${c.rgb} placeholder="28 28 28" hint="Liczy się sam z HEX-a" onInput=${(v) => up((x) => { x.colors[i].rgb = v; x.colors[i].rgbManual = true; })} />
        <${Text} label="CMYK" value=${c.cmyk} placeholder="0 0 0 95" onInput=${(v) => up((x) => { x.colors[i].cmyk = v; })} /></div>
        <div class="grid2"><${Text} label="Pantone" value=${c.pantone} onInput=${(v) => up((x) => { x.colors[i].pantone = v; })} />
        <${Text} label="RAL" value=${c.ral} onInput=${(v) => up((x) => { x.colors[i].ral = v; })} /></div>
        <p class="note">${used.length ? `Używany: ${used.join(", ")}.` : "Nieużywany poza blokiem „Paleta”."}</p>
      <//>`;
    })}
    <button type="button" class="btn is--add" onClick=${() => { const id = uid(); up((x) => { (x.colors ||= []).push({ id, name: "", hex: "#000000", rgb: "0 0 0", cmyk: "", pantone: "", ral: "" }); }); setOpen(id); }}>+ Dodaj kolor</button>
  </div>`;
}

// Ostrzeżenia grup — wypływają na nagłówek, żeby nie trzeba było otwierać wszystkiego
export function brandWarnings(b) {
  const th = sidebarTheme({ brand: b }), lc = b.logoColor || "file";
  const w = {};
  if (!(b.name || "").trim()) w.doc = "brak nazwy marki";
  if ((b.colors || []).some((c) => !/^#[0-9a-f]{6}$/i.test(c.hex || ""))) w.colors = "kolor bez poprawnego HEX";
  if (fontOf({ brand: b }) === "areal") w.look = "Areal tylko z licencją klienta";
  else if (th?.dark && lc === "file" && !b.logoDark && b.logo) w.look = "ciemny pasek — logo może zniknąć";
  else if (lc !== "file" && b.logo && !/\.svg$/i.test(b.logo)) w.look = "kolor logo działa tylko dla SVG";
  if (b.ogImage && !(b.siteUrl || "").trim()) w.share = "obrazek bez adresu manuala";
  if (b.protect === "server" && (b.password || "").trim() && !(b.siteUrl || "").trim()) w.access = "";
  return w;
}

export function BrandForm({ b, set, ctx }) {
  const up = (fn) => set((x) => fn(x));
  const [open, toggle] = useGroups({ doc: true });
  const th = sidebarTheme({ brand: b });
  const w = brandWarnings(b);
  const font = fontOf({ brand: b });
  const accent = accentOf(b);
  const lc = b.logoColor || "file";
  const lcName = lc === "file" ? "logo z pliku" : lc === "auto" ? "logo auto" : lc === "custom" ? `logo ${b.logoHex || ""}` : `logo ${colorName(b, lc) || ""}`;
  const colors = b.colors || [];
  return html`<div class="panel__inner">
    <h2 class="h">Marka</h2>

    <${Group} id="doc" title="Dokument" open=${open.doc} onToggle=${toggle} warn=${w.doc} onSpot=${() => ctx.spot(".cover.is--start")}
      summary=${[b.name, b.documentTitle, b.version && `v${b.version}`, b.mode === "single" ? "single" : "multi"].filter(Boolean).join(" · ")}>
      <div class="grid2"><${Text} label="Nazwa marki" value=${b.name} onInput=${(v) => up((x) => { x.name = v; })} />
      <${Text} label="Tytuł dokumentu" value=${b.documentTitle} placeholder="Księga znaku" onInput=${(v) => up((x) => { x.documentTitle = v; })} /></div>
      <div class="grid2"><${Text} label="Wersja" value=${b.version} onInput=${(v) => up((x) => { x.version = v; })} />
      <${Text} label="Data" value=${b.date} placeholder="październik 2026" onInput=${(v) => up((x) => { x.date = v; })} /></div>
      <${Select} label="Tryb strony" value=${b.mode} options=${[["multi", "Multi site — osobna strona na rozdział"], ["single", "Single site — wszystko na jednej stronie"]]} onChange=${(v) => ctx.switchMode(v)} />
    <//>

    <${Group} id="colors" title="Kolory marki" open=${open.colors} onToggle=${toggle} warn=${w.colors}
      summary=${colors.length ? html`<span class="group__chips">${colors.slice(0, 8).map((c) => html`<span class="check__chip" style=${`background:${c.hex}`}></span>`)}</span>${colors.length} ${colors.length === 1 ? "kolor" : colors.length < 5 ? "kolory" : "kolorów"}` : "brak"}>
      <p class="note">Z tej palety korzystają bloki „Paleta” i „Pary kontrastowe” oraz kolory paska, logo i akcentu.</p>
      <${ColorList} b=${b} up=${up} ctx=${ctx} />
    <//>

    <${Group} id="look" title="Logo i oprawa" open=${open.look} onToggle=${toggle} warn=${w.look} onSpot=${() => ctx.spot(".sidebar")}
      summary=${[b.logo ? lcName : "bez logo", th ? `pasek ${th.name}` : "pasek biały", font === "geist" ? "Geist" : font === "areal" ? "Areal" : "systemowy"].join(" · ")}>
      <b class="group__sub">Logo</b>
      <${FileField} label="Plik logo (SVG)" value=${b.logo} accept=".svg,image/svg+xml,image/png" folder="media" ctx=${ctx} expect=${{ w: 210, h: 72 }} hint="Ramka 210×72 z Figmy, przezroczysta" onChange=${(p) => up((x) => { x.logo = p; })} />
      <${ColorPick} label="Kolor logo (SVG)" b=${b} value=${lc} hex=${b.logoHex} extra=${[["file", "Z pliku"], ["auto", "Automatycznie — biel lub czerń do tła"]]}
        onPick=${(v) => up((x) => { x.logoColor = v; if (v === "custom" && !x.logoHex) x.logoHex = "#FFFFFF"; })} onHex=${(v) => up((x) => { x.logoHex = v; })} />
      ${lc !== "file" && html`<p class="note">Logo staje się jednobarwne — wszystkie elementy dostają ten kolor. Logo wielobarwne zostaw „Z pliku”.</p>`}
      ${(lc === "file" || b.logoDark) && html`<${FileField} label="Logo na ciemnym tle (opcjonalne)" value=${b.logoDark} accept=".svg,image/svg+xml,image/png" folder="media" ctx=${ctx} expect=${{ w: 210, h: 72 }}
        hint=${th?.dark ? (b.logoDark ? "Używane teraz — pasek jest ciemny." : "Pasek jest ciemny: wgraj jasną wersję logo albo ustaw kolor logo wyżej.") : "Używane automatycznie, gdy pasek jest ciemny."}
        onChange=${(p) => up((x) => { x.logoDark = p; })} />`}


      <b class="group__sub">Pasek boczny</b>
      <${ColorPick} label="Kolor paska" b=${b} value=${th || b.sidebarColor === "custom" ? b.sidebarColor : ""} hex=${b.sidebarHex} defLabel="Domyślny (biały)"
        onPick=${(v) => up((x) => { x.sidebarColor = v || null; if (v === "custom" && !x.sidebarHex) x.sidebarHex = "#1C1C1C"; })} onHex=${(v) => up((x) => { x.sidebarHex = v; })} />
      ${th && html`<p class="note">Tekst spisu: ${th.dark ? "jasny" : "ciemny"} (kontrast ${th.ratio.toFixed(1).replace(".", ",")}:1).${th.underline ? ` Akcent ma na tym tle tylko ${contrastRatio(th.bg, accent).toFixed(1).replace(".", ",")}:1, więc aktywna pozycja będzie ${th.dark ? "biała" : "czarna"} z podkreśleniem.` : " Aktywna pozycja w kolorze akcentu."} Ten sam kolor ma menu „Indeks” i górny pasek na tablecie i telefonie.</p>`}
      <b class="group__sub">Akcent</b>
      <${ColorPick} label="Kolor akcentu" b=${b} value=${b.accentColor || (b.accent ? "custom" : "")} hex=${b.accent || "#000000"} defLabel="Domyślny (czarny)"
        onPick=${(v) => up((x) => { x.accentColor = v || null; if (v === "custom" && !x.accent) x.accent = "#000000"; if (!v) x.accent = null; })} onHex=${(v) => up((x) => { x.accent = v; })} />
      <p class="note">Linki, aktywna pozycja spisu, przyciski. Kolor z palety zmienia się razem z paletą.</p>

      <b class="group__sub">Krój</b>
      <${Select} label="Krój manuala" value=${font} options=${[["geist", "Geist (domyślny, darmowa licencja OFL)"], ["areal", "ABC Areal — tylko z licencją webową klienta"], ["system", "Systemowy (SF Pro, Segoe UI, Helvetica, Arial)"]]} onChange=${(v) => up((x) => { x.font = v; })} />
      <p class="note">${font === "areal" ? "Licencja Dinamo obejmuje jedną domenę i jednego licencjobiorcę — klient musi kupić własną licencję webową na swoją domenę. Pliki wgrywasz w menu projektu → Krój ABC Areal." : font === "geist" ? "Geist jest na licencji SIL Open Font License — wolno go dołączyć do strony klienta. Pliki (ok. 95 KB) trafiają do eksportu." : "Bez plików fontu — każdy zobaczy krój swojego systemu."}</p>

      <b class="group__sub">Okładka</b>
      <${FileField} label="Zdjęcie okładki manuala (opcjonalne)" value=${b.cover} accept="image/jpeg,image/png,image/webp" folder="media" ctx=${ctx} hint="Szablon z Figmy: 1440×900, eksport 2x. Bez zdjęcia okładka ma kolor tła." onChange=${(p) => up((x) => { x.cover = p; })} />
    <//>
  </div>`;
}

// Studio: podpis KHOREI w stopce manuala
export function StudioForm({ b, set, ctx }) {
  const up = (fn) => set((x) => fn(x));
  useEffect(() => { ctx.spot(".footer"); }, []);
  return html`<div class="panel__inner">
    <h2 class="h">Studio</h2>
    <p class="note">Podpis studia w stopce każdej strony manuala.</p>
    <${Text} label="E-mail kontaktowy" value=${b.contact} placeholder="studio@khorei.com" hint="Stoi w stopce pod „Masz pytania?”. W gotowym manualu klik otwiera program pocztowy." onInput=${(v) => up((x) => { x.contact = v; })} />
    <p class="note">Logo KHOREI i „Designed by KHOREI” linkują do khorei.com. Nota prawna i sygnatura wdrożenia trafiają do eksportu automatycznie (LICENSE.txt).</p>
  </div>`;
}

export function PublishForm({ b, set, ctx }) {
  const up = (fn) => set((x) => fn(x));
  const [open, toggle] = useGroups({ doc: true });
  const w = brandWarnings(b);
  const pw = (b.password || "").trim();
  return html`<div class="panel__inner">
    <h2 class="h">Wydanie</h2>
    <p class="note">Ustawienia na koniec — przed eksportem dla klienta.</p>

    <${Group} id="address" title="Adres manuala" open=${open.address} onToggle=${toggle}
      summary=${(b.siteUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, "") || "bez adresu"}>
      <${Text} label="Adres manuala" value=${b.siteUrl} placeholder="https://klient.pl/brandbook/" hint="Wpisywany do licencji (LICENSE.txt) jako adres, pod którym klient może uruchomić manual. Potrzebny też do obrazka udostępniania." onInput=${(v) => up((x) => { x.siteUrl = v; })} />
    <//>

    <${Group} id="access" title="Dostęp" open=${open.access} onToggle=${toggle}
      summary=${!pw ? "otwarty" : (b.protect || "encrypt") === "encrypt" ? "hasło — szyfrowanie stron" : "hasło serwera (.htaccess)"}>
      <${Text} label="Hasło do manuala (puste = otwarty)" value=${b.password} placeholder="np. marka2026" onInput=${(v) => up((x) => { x.password = v; })} />
      ${pw && html`
        <${Select} label="Sposób ochrony" value=${b.protect || "encrypt"} options=${[["encrypt", "Szyfrowanie stron (każdy serwer)"], ["server", "Hasło serwera (.htaccess, Apache)"]]} onChange=${(v) => up((x) => { x.protect = v; })} />
        ${(b.protect || "encrypt") === "server" && html`<${Text} label="Login" value=${b.login} placeholder="klient" onInput=${(v) => up((x) => { x.login = v; })} />`}`}
      ${pw && html`<p class="note">Hasła nie zapisujemy w pliku backupu (.khorei) — po wczytaniu backupu na innym komputerze wpisz je ponownie. Zapis do folderu je zachowuje.</p>`}
      <p class="note">${!pw ? "Bez hasła manual jest otwarty dla każdego, kto zna adres."
        : (b.protect || "encrypt") === "encrypt" ? "Eksport szyfruje treść stron — bez hasła nie da się jej przeczytać. Hasło wpisuje się raz na sesję przeglądarki. Pliki do pobrania (media/, files/) pozostają dostępne pod bezpośrednim adresem, jeśli ktoś go zna."
        : "Serwer pyta o login i hasło, zanim wyda cokolwiek — strony, zdjęcia i pliki. Działa na hostingach z Apache (cPanel, home.pl, nazwa.pl, OVH, LH.pl). Po wgraniu trzeba wpisać w .htaccess pełną ścieżkę folderu — instrukcja jest w pliku CZYTAJ-HASLO.txt w eksporcie. Uwaga: jeśli serwer nie obsługuje .htaccess (np. nginx, Netlify), manual będzie otwarty — wtedy wybierz szyfrowanie."}</p>
    <//>

    <${Group} id="share" title="Udostępnianie" open=${open.share} onToggle=${toggle} warn=${w.share}
      summary=${[b.favicon ? "favicon" : "bez favicony", b.ogImage ? "obrazek linku" : "bez obrazka linku"].join(" · ")}>
      <${FileField} label="Favicon (SVG lub PNG 512×512)" value=${b.favicon} accept=".svg,image/svg+xml,image/png" folder="media" ctx=${ctx} onChange=${(p) => up((x) => { x.favicon = p; })} />
      <${FileField} label="Obrazek do udostępniania (1200×630)" value=${b.ogImage} accept="image/png,image/jpeg" folder="media" ctx=${ctx} expect=${{ w: 1200, h: 630 }} hint="Pokazuje się, gdy ktoś wklei link do manuala w Slacku, mailu czy na LinkedIn. Wymaga adresu manuala." onChange=${(p) => up((x) => { x.ogImage = p; })} />
    <//>
  </div>`;
}

