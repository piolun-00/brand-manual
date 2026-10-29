# CLAUDE.md — edytor brandmanuala KHOREI

Kontekst dla Claude przy pracy w tym repozytorium. Właściciel: Radek, studio KHOREI (Kraków).
Pisze po polsku, jest ekspertem od designu, nie programuje — opisuje logikę, Claude dobiera technikę
i zawsze tłumaczy „dlaczego”. Komunikaty w UI i komentarze w kodzie: po polsku.

## Architektura
- Nawigacja edytora: Ustawienia dokumentu (widok `brand`, `BrandForm`; dawniej „Marka”) · Rozdziały · Wydanie (`publish`) · Stopka (`studio`).
- Statyczny edytor w przeglądarce (GitHub Pages), bez builda: ES modules, Preact + htm, import map w `index.html`.
- Edytor w modułach: `core` → `fields` → `blocks` / `forms` / `preview` → `app`. Moduły importują się nawzajem
  dynamicznie z `?v=` (`const Q = new URL(import.meta.url).search`), żeby wersja w adresie obejmowała wszystkie pliki.
  Bez cykli — zależności idą tylko w prawo.
- JSZip w edytorze wczytywany leniwie (`ZipLib()` w `app.js`) — dopiero przy eksporcie, backupie i wczytaniu backupu; nie dodawaj go z powrotem do `index.html`.
- Dane: IndexedDB (`editor/store.js`: projects, assets, meta). Opcjonalny zapis do folderu (File System Access API).
- `engine/render.js` — jeden kod dla podglądu (iframe srcdoc, podmiana treści bez przeładowania) i eksportu.
  `ctx.preview` rozróżnia tryby. Akcje bloków: belka opisu bloku → nagłówek sekcji → panel.
- `engine/runtime.js` — string wstrzykiwany do stron eksportu: nawigacja SPA (`fix()` przepisuje względne ścieżki,
  `shownPath` + `keep()` chronią kotwice), scroll-spy, leniwe ładowanie bibliotek (`data-lib`), Lottie inline
  (działa z `file://`), pauza wideo poza ekranem, `window.khInitMedia`.
- Tokeny z `engine/figma-variables.json` (Typography: tryby Geist / ABC Areal). Klasy CSS = nazwy warstw w Figmie (BEM).
- Pasek boczny: kolor tła wybiera użytkownik, tekst liczy się sam (kontrast ≥ 4.5:1, `sidebarTheme`).
- Okładka (`coverTheme`): zdjęcie albo jednolity kolor; domyślnie ciemnoszare #3C3C3A i biały tekst (tokeny `bg/cover`, `text/cover`);
  nazwa marki na desktopie łamie się dopiero po zajęciu 50% szerokości okładki.
- Demo kodu (blok `code`): podgląd w ramce `srcdoc` z sandboxem w edytorze; w eksporcie `demos/<…>/index.html` + `style.css` + `script.js`
  (bez sandboxa — fonty manuala z tego samego serwera) i ZIP w `files/`. Licencja dema (`legal.js`: `CODE_LICENSES`, `demoHeaders`,
  `demoLicenseText`, `demoSig`): domyślnie view (tylko do wglądu: bez „Kopiuj” i „Otwórz”, ZIP zostaje) / none (bez zakładki „Licencja” i not) / brand / owned / custom
  (własny tekst albo wgrany plik LICENSE); z licencją: zakładka „Licencja”, nota w każdym pliku, LICENSE.txt w folderze i ZIP-ie, sygnatura manuala + znacznik bloku. Na dotyku demo ma warstwę „Dotknij, aby uruchomić demo” (strona przewija się nad demem; „Gotowe” lub zjechanie wyłącza). Strony dem zawsze noindex/noai. Kod Nami nie trafia do repo (licencja) — test używa `tests/fixtures/demo`.
- Kroje pisma (`brand.fonts`: nazwa wyświetlana, odmiany z plików — `readFontFile` czyta tabele name / OS/2 z OTF / TTF, WOFF2 po nazwie pliku;
  `licensed` + `licensedAt`). Bloki Typografia / Skala wybierają krój (`b.font`), zakładki odmian `[data-type-style]`; skala modularna
  `typeScale(base, ratio)`. Krój bez potwierdzonej licencji: tylko podgląd — eksport go pomija (pliki i @font-face), blok wraca do SVG;
  LICENSE.txt wymienia osadzone kroje z datą oświadczenia. Pliki krojów nigdy do repo (test: KaTeX, MIT, w `tests/fixtures/font`).
- Stopka (`footer` w `render.js`, zakładka „Stopka” = `StudioForm`, widok `studio`; grupy credit / studio / color; `footerWarnings`: e-mail i www sprawdzane, błędne zostają tekstem bez linku): podpis KHOREI zawsze; opcjonalny pas studia projektowego nad linią
  (`brand.studio`: on, logo SVG, name, author, email, www — `studioOf`), logo przebarwiane na kolor tekstu stopki.
  Kolor tła stopki `brand.footerColor` / `footerHex` (`footerTheme`: tekst biały/czarny, ≥ 4.5:1). Z pasem LICENSE.txt
  przypisuje studiu autorstwo identyfikacji i treści (w tym doboru typografii); KHOREI zostaje autorem kodu i szablonu.
- Lista kontrolna (`exportChecks` w `app.js`): każda pozycja ma adres `go = { view, group?, field?, section?, block? }`;
  puste miejsca rozpisane na bloki (`blockInfo`), brakujące pliki wskazują blok, który ich używa, Lottie z wyrażeniami / obrazkami
  w osobnych plikach (`checkLottie`, wynik zapamiętany na ścieżkę pliku w `lottieCache`). `goTo(go)` otwiera zakładkę,
  grupę (`useGroups(defaults, ctx.want)`, `data-group`) albo kartę bloku (`select`), przewija, podświetla (`.is--flash`)
  i ustawia kursor w pierwszym pustym polu (najpierw plik, pola „opcjonalne” pomija). Po pierwszym eksporcie lista zostaje
  jako pływająca etykieta `.dock` „Ostrzeżenia N” w lewym dolnym rogu i przelicza się po każdej zmianie (600 ms).
- Eksport (`exportZip` w `editor/app.js`): lista kontrolna → pliki, wersje @1x, plakaty MP4, ZIP-y ikon / Lottie,
  odtwarzacze tylko gdy użyte, licencja (`engine/legal.js`), sygnatura `KHOREI-BM-rok-…`, hasło (AES-GCM w `lock.js`
  albo `.htaccess` + bcrypt).

## Zasady
- Nigdy nie dodawaj licencjonowanych krojów (ABC Areal) do repozytorium — tylko Geist (OFL).
- SVG wstawiane inline zawsze przez DOMPurify (`inlineSvg`).
- Backup `.khorei` nie zawiera hasła; zapis do folderu je zawiera.
- Przed pushem: `cd tests && node --test --test-concurrency=1 e2e.test.mjs extended.test.mjs` (testy same stawiają serwer). Nowa funkcja = nowy przypadek w `tests/e2e.test.mjs`.
- Kolory tekstu w eksporcie muszą przechodzić axe (≥ 4.5:1) — tokeny w `engine/figma-variables.json` zmieniaj też w Figmie.
- Workflow `pages.yml`: najpierw testy (job `test`), dopiero po zielonych publikacja z numerem wersji; `scripts/release.sh` tylko lokalnie.
- GitHub: tylko REST przez `gh`; push tagów daje 403 — backupy jako gałęzie `backup/…`.
- Commity kończą się:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: <link sesji>
  ```

## Decyzje odłożone
- Wersja EN manuala — po wersji 1.0.
- Wersja do druku / PDF — nie teraz.
- Gradient na okładce — odrzucony.
- Własna domena edytora, numer wersji silnika w eksporcie — na końcu.

## Figma
Dedykowany plik „Brand Manual (PRD)”: `WEqpBOOCNfbF2ptFAqLood` (duplikat starego pliku — numery węzłów i zmienne bez zmian).
Strony: Cover 33:2 · Read me 3001:8197 (mapa pliku) · Widoki manuala 1303:548 (desktop, mobile i tablet) · Komponenty 3008:787 · Edytor 3062:2 (interfejs edytora: ostrzeżenia `dock`) · Szablony eksportu 3008:788 · Branding 3001:8196 (naming i branding produktu) · Szkice 3008:789 · Archiwum 3001:1281.
Środowisko Figmy przez API nie ma krojów ABC Areal ani Aujournuit — węzłów z tymi krojami nie da się przenosić ani edytować tekstu (tylko pozycja).
Stary plik `nWmpctwP4yNlI3BulXAUk2` — już nie używać.
Zmienne `bg/sidebar`, `text/sidebar`, `text/sidebar-active`, `bg/cover`, `text/cover`.
Wersję nazwaną w historii zapisuje Radek ręcznie (API tego nie obsługuje).

## Dokumentacja (poza repo)
- Opis projektu (zasady, decyzje, naming): https://claude.ai/artifact/8B7ctr4SAZFueiCg843T3T
- Architektura kodu: https://claude.ai/artifact/KNLGSera2ExyJFLwywjxzt
- Po większej zmianie aktualizuj ten plik, README i właściwy dokument w tej samej sesji.
- „Brandmanual KHOREI” to nazwa robocza — po wyborze nazwy produktu zmienić m.in. format backupu `.khorei`, bazę IndexedDB `khorei-brandmanual`, prefiks sygnatury `KHOREI-BM`, teksty w `legal.js` (z migracją starych projektów).
