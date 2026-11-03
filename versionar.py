#!/usr/bin/env python3
# Pone en las páginas una marca ?v= según el contenido de estilo.css, llave.js, app.js y
# favicon.svg. GitHub Pages deja que el navegador guarde cada archivo 10 minutos; con la marca,
# en cuanto un archivo cambia la página pide el nuevo. Lo corre el hook pre-commit (ver README);
# también se puede correr a mano.
import hashlib, pathlib, re

AQUI = pathlib.Path(__file__).resolve().parent
ARCHIVOS = ["estilo.css", "llave.js", "app.js", "favicon.svg"]
PAGINAS = ["index.html", "acerca.html", "privacidad.html"]

marca = {a: hashlib.sha256((AQUI / a).read_bytes()).hexdigest()[:10] for a in ARCHIVOS}
patron = re.compile(r'="(%s)(\?v=[0-9a-f]+)?"' % "|".join(map(re.escape, ARCHIVOS)))
for p in PAGINAS:
    ruta = AQUI / p
    viejo = ruta.read_text(encoding="utf-8")
    nuevo = patron.sub(lambda m: f'="{m.group(1)}?v={marca[m.group(1)]}"', viejo)
    if nuevo != viejo:
        ruta.write_text(nuevo, encoding="utf-8")
        print("versionado", p)
