# dashboard

Mi página de inicio, en https://dashboard.paulr.xyz (GitHub Pages).

El repositorio es público y solo tiene código: ningún dato, ninguna llave ni secreto.

- `index.html`, `estilo.css`, `llave.js` y `app.js` son la página. Sin la llave de mi Mac
  solo muestra el reloj y el buscador.
- Las luces del respaldo, la última nota y el permiso de Google los da un servidor local
  que solo corre en mi Mac (`127.0.0.1:47863`) y no vive en este repositorio.
- Google se conecta con Google Identity Services (modelo de código, cliente "Aplicación
  web"). La página llama a Tasks y Calendar directamente, con tokens de una hora.
- `acerca.html` y `privacidad.html` son las páginas que pide Google para publicar la app.
- Antes de cada commit se corre `python3 versionar.py`: pone en las páginas una marca `?v=`
  según el contenido de `estilo.css`, `llave.js`, `app.js` y `favicon.svg`, para que ni el
  navegador ni el CDN de GitHub Pages sirvan una copia vieja.
