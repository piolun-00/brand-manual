# KHOREI — edytor brandmanuala

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

Kroje: pliki krojów z licencją komercyjną wgrywaj w edytorze (trafiają do eksportu klienta), nigdy do tego repozytorium.
