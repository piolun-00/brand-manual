#!/bin/bash
# Numer wersji edytora w index.html i version.json (wymusza świeże pliki w przeglądarkach).
# Publikacja na GitHub Pages robi to sama przy każdym wdrożeniu — lokalnie uruchamiaj tylko do testów.
# Opcjonalny argument: własny numer wersji.
set -e
cd "$(dirname "$0")/.."
V="${1:-$(TZ=Europe/Warsaw date +%Y.%m.%d.%H%M)}"
sed -i.bak -E "s#(editor/(app\.js|editor\.css))(\?v=[^\"]*)?\"#\1?v=$V\"#g" index.html && rm -f index.html.bak
printf '{ "version": "%s" }\n' "$V" > version.json
echo "Wersja $V"
