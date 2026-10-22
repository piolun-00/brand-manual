#!/bin/bash
# Nowa wersja edytora: jeden numer w index.html i version.json. Uruchom przed każdym wysłaniem zmian.
set -e
cd "$(dirname "$0")/.."
V="$(date +%Y.%m.%d.%H%M)"
sed -i.bak -E "s#(editor/(app\.js|editor\.css))(\?v=[^\"]*)?\"#\1?v=$V\"#g" index.html && rm -f index.html.bak
printf '{ "version": "%s" }\n' "$V" > version.json
echo "Wersja $V"
