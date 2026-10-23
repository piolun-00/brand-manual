# CLAUDE.md — edytor brandmanuala KHOREI

Kontekst dla Claude przy pracy w tym repozytorium. Właściciel: Radek, studio KHOREI (Kraków).
Pisze po polsku, jest ekspertem od designu, nie programuje — opisuje logikę, Claude dobiera technikę
i zawsze tłumaczy „dlaczego”. Komunikaty w UI i komentarze w kodzie: po polsku.

## Architektura
- Statyczny edytor w przeglądarce (GitHub Pages), bez builda: ES modules, Preact + htm, import map w `index.html`.
- Edytor w modułach: `core` → `fields` → `blocks` / `forms` / `preview` → `app`. Moduły importują się nawzajem
  dynamicznie z `?v=` (`const Q = new URL(import.meta.url).search`), żeby wersja w adresie obejmowała wszystkie pliki.
  Bez cykli — zależności idą tylko w prawo.
- Dane: IndexedDB (`editor/store.js`: projects, assets, meta). Opcjonalny zapis do folderu (File System Access API).
- `engine/render.js` — jeden kod dla podglądu (iframe srcdoc, podmiana treści bez przeładowania) i eksportu.
  `ctx.preview` rozróżnia tryby. Akcje bloków: belka opisu bloku → nagłówek sekcji → panel.
- `engine/runtime.js` — string wstrzykiwany do stron eksportu: nawigacja SPA (`fix()` przepisuje względne ścieżki,
  `shownPath` + `keep()` chronią kotwice), scroll-spy, leniwe ładowanie bibliotek (`data-lib`), Lottie inline
  (działa z `file://`), pauza wideo poza ekranem, `window.khInitMedia`.
- Tokeny z `engine/figma-variables.json` (Typography: tryby Geist / ABC Areal). Klasy CSS = nazwy warstw w Figmie (BEM).
- Pasek boczny: kolor tła wybiera użytkownik, tekst liczy się sam (kontrast ≥ 4.5:1, `sidebarTheme`).
- Eksport (`exportZip` w `editor/app.js`): lista kontrolna → pliki, wersje @1x, plakaty MP4, ZIP-y ikon / Lottie,
  odtwarzacze tylko gdy użyte, licencja (`engine/legal.js`), sygnatura `KHOREI-BM-rok-…`, hasło (AES-GCM w `lock.js`
  albo `.htaccess` + bcrypt).

## Zasady
- Nigdy nie dodawaj licencjonowanych krojów (ABC Areal) do repozytorium — tylko Geist (OFL).
- SVG wstawiane inline zawsze przez DOMPurify (`inlineSvg`).
- Backup `.khorei` nie zawiera hasła; zapis do folderu je zawiera.
- Przed pushem: `cd tests && node --test --test-concurrency=1 e2e.test.mjs extended.test.mjs` (testy same stawiają serwer). Nowa funkcja = nowy przypadek w `tests/e2e.test.mjs`.
- Kolory tekstu w eksporcie muszą przechodzić axe (≥ 4.5:1) — tokeny w `engine/figma-variables.json` zmieniaj też w Figmie.
- Wersję nadaje workflow `pages.yml` przy wdrożeniu; `scripts/release.sh` tylko lokalnie.
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
- Blok „demo kodu” (rozwiązania kodowe klienta) — kierunek zaakceptowany, nie zaplanowany.

## Figma
Plik `nWmpctwP4yNlI3BulXAUk2`, strona 1303:548. Zmienne `bg/sidebar`, `text/sidebar`, `text/sidebar-active`.
Wersję nazwaną w historii zapisuje Radek ręcznie (API tego nie obsługuje).
