// Va en <head>, antes de pintar. Guarda la llave del enlace de una sola vez
// (#llave=…, lo abre dashboard/scripts/servidor_local.py --llave en la Mac), la borra de
// la barra de direcciones y marca <html> para que se vean las tarjetas de la Mac.
// Sin llave, estilo.css deja solo el reloj y el buscador. Dashboard.html (data-modo="local",
// un archivo en la Mac) no necesita llave: siempre muestra todo.
(function () {
  if (document.documentElement.dataset.modo === "local") {
    document.documentElement.classList.add("llave");
    return;
  }
  function guardar() {
    const m = location.hash.match(/^#llave=([\w-]{32,})$/);
    if (!m) return false;
    localStorage.setItem("llave", m[1]);
    history.replaceState(null, "", location.pathname + location.search);
    return true;
  }
  try {
    guardar();
    if (localStorage.getItem("llave")) document.documentElement.classList.add("llave");
    // el enlace abierto sobre la página ya cargada solo cambia el fragmento: se recarga
    window.addEventListener("hashchange", () => { if (guardar()) location.reload(); });
  } catch (e) {
    // sin localStorage (ventana privada estricta): se queda sin llave
  }
})();
