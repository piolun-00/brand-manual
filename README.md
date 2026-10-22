# KHOREI — edytor brandmanuala

> Kod objęty zastrzeżeniem praw — szczegóły w pliku [LICENSE](LICENSE). Publiczne repozytorium
> (wymóg GitHub Pages) nie jest licencją. Składniki open source: [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Edytor online do budowania brandmanuali. Działa w przeglądarce, bez serwera i bez instalacji.
Każdy manual to osobna instancja: uzupełniasz w edytorze → **Eksport ZIP** → wgrywasz na serwer klienta.

## Jak pracować
1. Otwórz edytor (GitHub Pages). Lista projektów: przycisk z nazwą marki u góry.
2. **Marka i ustawienia** — nazwa, wersja, tryb multi/single, logo, akcent, kroje.
3. **Rozdziały** → sekcje → bloki (zdjęcia, specimeny, paleta, kontrast, krój, skala). Podgląd obok, z suwakiem szerokości.
4. **Eksport ZIP** — gotowa strona (HTML + CSS + pliki). Działa z dowolnego folderu na serwerze.
5. **Backup na dysk** — plik `.khorei` z całym projektem. **Wczytaj backup** — poprawki po czasie i ponowny eksport.

Projekty zapisują się same w tej przeglądarce (IndexedDB). Nic nie trafia na serwer. Backup trzymaj w folderze klienta.

## Co gdzie jest
| Ścieżka | Co |
| --- | --- |
| `engine/render.js` | silnik: dane projektu → strony HTML (ten sam kod dla podglądu i eksportu) |
| `engine/tokens.js` | tokeny CSS z eksportu zmiennych Figmy + ustawień marki |
| `engine/figma-variables.json` | eksport zmiennych i stylów tekstu z Figmy |
| `engine/base.css` | układ manuala (klasy = warstwy w Figmie, BEM) |
| `engine/runtime.js` | skrypt strony: sidebar, kopiowanie HEX, przejścia bez przeładowania |
| `engine/sample.json` | przykładowa treść (21 rozdziałów) |
| `editor/` | edytor (Preact + htm, bez budowania) |
| `vendor/` | biblioteki: Preact, htm, JSZip |

Kroje: manual składany jest domyślnie w Geist (OFL — wolno dołączyć do strony klienta). ABC Areal tylko wtedy, gdy klient ma własną licencję webową Dinamo na swoją domenę; pliki wgrywasz w edytorze, nigdy do tego repozytorium.

## Licencja i ochrona eksportu

Każdy eksport dostaje komplet not, na wzór strony Nami™:

- `LICENSE.txt` — zgoda na uruchomienie pod adresem z pola „Adres manuala” i udostępnianie manuala osobom stosującym markę; bez prawa do powielania kodu i szablonu, bez przeniesienia praw; wyłączenie materiałów klienta (logo, kroje marki, zdjęcia) i zastrzeżenie TDM (art. 4 ust. 3 dyrektywy DSM).
- `THIRD-PARTY-NOTICES.txt` + `licenses/` — tylko biblioteki, których dany manual używa (Geist, Lottie, model-viewer + three.js).
- `robots.txt` — wyszukiwarki i podgląd linków tak, roboty zbierające dane do trenowania nie (działa w katalogu głównym domeny).
- W każdej stronie: komentarz nagłówkowy, meta `tdm-reservation`, `noai`, `copyright` i **sygnatura wdrożenia** (`KHOREI-BM-rok-…`, stała dla projektu) w `<html data-build>` — także w CSS, w skrypcie i w kluczu sesji hasła.
