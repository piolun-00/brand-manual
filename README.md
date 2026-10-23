# KHOREI — edytor brandmanuala

> Kod objęty zastrzeżeniem praw — szczegóły w pliku [LICENSE](LICENSE). Publiczne repozytorium
> (wymóg GitHub Pages) nie jest licencją. Składniki open source: [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Edytor online do budowania brandmanuali. Działa w przeglądarce, bez serwera i bez instalacji.
Każdy manual to osobna instancja: uzupełniasz w edytorze → **Eksport ZIP** → wgrywasz na serwer klienta.

## Jak pracować
1. Otwórz edytor (GitHub Pages). Lista projektów: przycisk z nazwą marki u góry.
2. **Marka** — trzy grupy: *Dokument* (nazwa, wersja, tryb multi / single), *Kolory marki* (zwijane: nazwa + HEX), *Logo i oprawa* (logo i jego kolor, pasek boczny, akcent, krój, okładka). Ostrzeżenia wypływają na nagłówki grup.
3. **Rozdziały** → sekcje → bloki. Podgląd obok, z suwakiem szerokości; kliknięcie w ustawienie podświetla jego miejsce w podglądzie.
4. **Publikacja** — *Wydanie* (adres manuala, dostęp / hasło, favicon i obrazek linku) oraz *Studio* (kontakt w stopce).
5. **Eksport ZIP** — najpierw lista kontrolna (brak adresu, puste miejsca, brakujące pliki, ostrzeżenia marki), potem gotowa strona do wgrania. Działa z dowolnego folderu na serwerze.
6. **Zapisuj w folderze…** (Chrome / Edge) — każda zmiana trafia też na dysk. W Safari: **Backup na dysk** (`.khorei`) i **Wczytaj backup**. Backup nie zawiera hasła manuala.

Projekty zapisują się same w tej przeglądarce (IndexedDB). Nic nie trafia na serwer.

## Bloki
| Blok | Co pokazuje |
| --- | --- |
| Tekst | 1 lub 2 kolumny |
| Rząd zdjęć | 1–4 zdjęcia; eksport dodaje wersję @1x dla telefonów |
| Specimeny znaku | logo / symbol na polach |
| Paleta, Pary kontrastowe | kolory marki z HEX / RGB / CMYK i kontrastem WCAG |
| Ikony | siatka SVG, pobieranie pojedynczo (hover) i całości (ZIP) |
| Krój, Skala typograficzna | specimen SVG, grafika skali |
| Animacja / wideo | MP4 (z klatką startową) lub embed |
| Animacje Lottie | 2 kolumny na animację, pobieranie JSON i ZIP |
| Model 3D | GLB lub OBJ (konwersja do GLB w edytorze), obrót 360° |

Przycisk akcji bloku (ZIP, GLB) stoi w jego belce opisu; bez belki — w nagłówku sekcji.

## Co gdzie jest
| Ścieżka | Co |
| --- | --- |
| `engine/render.js` | silnik: dane projektu → strony HTML (ten sam kod dla podglądu i eksportu) |
| `engine/runtime.js` | skrypt strony: nawigacja bez przeładowania, spis treści, leniwe ładowanie Lottie / 3D, kopiowanie HEX |
| `engine/legal.js` | licencja eksportu, nagłówki prawne, sygnatura wdrożenia |
| `engine/lock.js` | szyfrowanie stron hasłem (AES-GCM) |
| `engine/tokens.js` | tokeny CSS z eksportu zmiennych Figmy + ustawień marki |
| `engine/figma-variables.json` | eksport zmiennych i stylów tekstu z Figmy |
| `engine/base.css` | układ manuala (klasy = warstwy w Figmie, BEM) |
| `engine/vendor/` | odtwarzacze dołączane do eksportu tylko, gdy są użyte (Lottie, model-viewer) |
| `engine/sample*.json` | przykładowa treść (multi i single site) |
| `editor/` | edytor (Preact + htm, bez budowania) |
| `vendor/` | biblioteki edytora: Preact, htm, JSZip, bcryptjs, DOMPurify, three.js (konwersja OBJ) |

## Wdrożenie
Każdy push na `main` publikuje edytor na GitHub Pages. Numer wersji (`version.json`, `?v=` w `index.html`) nadaje workflow przy wdrożeniu — `scripts/release.sh` służy tylko do testów lokalnych.

Kroje: manual składany jest domyślnie w Geist (OFL — wolno dołączyć do strony klienta). ABC Areal tylko wtedy, gdy klient ma własną licencję webową Dinamo na swoją domenę; pliki wgrywasz w edytorze, nigdy do tego repozytorium.

## Licencja i ochrona eksportu

Każdy eksport dostaje komplet not, na wzór strony Nami™:

- `LICENSE.txt` — zgoda na uruchomienie pod adresem z pola „Adres manuala” i udostępnianie manuala osobom stosującym markę; bez prawa do powielania kodu i szablonu, bez przeniesienia praw; wyłączenie materiałów klienta (logo, kroje marki, zdjęcia) i zastrzeżenie TDM (art. 4 ust. 3 dyrektywy DSM).
- `THIRD-PARTY-NOTICES.txt` + `licenses/` — tylko biblioteki, których dany manual używa (Geist, Lottie, model-viewer + three.js).
- `robots.txt` — wyszukiwarki i podgląd linków tak, roboty zbierające dane do trenowania nie (działa w katalogu głównym domeny).
- W każdej stronie: komentarz nagłówkowy, meta `tdm-reservation`, `noai`, `copyright` i **sygnatura wdrożenia** (`KHOREI-BM-rok-…`, stała dla projektu) w `<html data-build>` — także w CSS, w skrypcie i w kluczu sesji hasła.
