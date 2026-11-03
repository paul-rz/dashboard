// Dashboard web (https://dashboard.paulr.xyz). El reloj y el buscador funcionan
// en cualquier lado; lo demás solo aparece en la Mac que tiene la llave:
// - las luces del respaldo y la última nota las da el servidor local
//   (dashboard/scripts/servidor_local.py, en 127.0.0.1);
// - las clases (Calendar, solo lectura) y las tareas (Tasks, con casilla) se piden
//   directo a Google con un token de una hora que también da el servidor local.
// La misma página corre como archivo en la Mac (Dashboard.html, <html data-modo="local">):
// ahí lee los .js que escriben los scripts del respaldo y las tareas son de solo lectura.
// Este repositorio es público: aquí no hay datos ni secretos.

// Tema: "forest" (#014421), "evergreen" (#05472A) o "dark" (#006400).
const TEMA = "forest";
const SERVIDOR = "http://127.0.0.1:47863";

// Valores tomados de cada manifest.json: ntp_background, frame, omnibox_background,
// tab_background_text y ntp_link.
const TEMAS = {
  forest:    {bg: "#014421", card: "#01361a", campo: "#013017", mut: "#c8e6d2", ac: "#c8ffdc"},
  evergreen: {bg: "#05472a", card: "#043922", campo: "#04321d", mut: "#c8e6d7", ac: "#c8ffe1"},
  dark:      {bg: "#006400", card: "#005000", campo: "#004600", mut: "#c8e6c8", ac: "#c8ffc8"},
};
const t = TEMAS[TEMA] || TEMAS.forest;
for (const k in t) document.documentElement.style.setProperty("--" + k, t[k]);

const $ = id => document.getElementById(id);
const hm = d => d.toLocaleTimeString("es-MX", {hour: "2-digit", minute: "2-digit"});
const LOCAL = document.documentElement.dataset.modo === "local";
const LLAVE = LOCAL ? null : (() => { try { return localStorage.getItem("llave"); } catch (e) { return null; } })();
// Horas en que launchd corre el respaldo; las lee el servidor del plist.
let HORAS = [];

function reloj() {
  const d = new Date();
  $("hora").textContent = hm(d);
  $("fecha").textContent = d.toLocaleDateString("es-MX", {weekday: "long", day: "numeric", month: "long"});
  if (!LLAVE && !LOCAL) return;
  $("prox").textContent = HORAS.length ? `Sync en ${faltan()}` : "—";
  for (const c of $("l-prox").children) c.title = HORAS.length ? `Próximo sync: ${proxima()}` : "";
}


function cuando(s) {
  const d = new Date(s * 1000), hoy = new Date();
  return d.toDateString() === hoy.toDateString() ? hm(d)
    : d.toLocaleDateString("es-MX", {weekday: "short", day: "numeric"}) + " " + hm(d);
}
function siguiente() {
  const d = new Date(), s = new Date(d), h = HORAS.find(x => x > d.getHours());
  if (h === undefined) { s.setDate(s.getDate() + 1); s.setHours(HORAS[0], 0, 0, 0); }
  else s.setHours(h, 0, 0, 0);
  return s;
}
function proxima() {
  const s = siguiente();
  return (s.getDate() === new Date().getDate() ? "" : "mañana ") + `${s.getHours()}:00`;
}
function faltan() {
  const m = Math.ceil((siguiente() - new Date()) / 60000), h = Math.floor(m / 60);
  return h ? `${h} h` + (m % 60 ? ` ${m % 60} min` : "") : `${m} min`;
}
reloj(); setInterval(reloj, 15000);
// luz(id, clase, texto, detalle): clase es "on", "warn", "crit" o "" (apagada)
function luz(id, cls, txt, det) {
  const f = $(id);
  f.className = "fila " + cls;
  f.querySelector("time").textContent = txt;
  // la fila no tiene caja propia (display:contents): el tooltip va en cada celda
  const tip = [det, HORAS.length ? `Próxima copia: ${proxima()}` : ""].filter(Boolean).join("\n\n");
  for (const c of f.children) c.title = tip;
}

// Servidor local: todo lleva la llave. Sin red (servidor apagado o Brave sin
// permiso para localhost) el error lleva codigo "sin_mac".
async function local(ruta, opciones = {}) {
  let r;
  try {
    r = await fetch(SERVIDOR + ruta, Object.assign({cache: "no-store"}, opciones, {
      headers: Object.assign({Authorization: "Bearer " + LLAVE}, opciones.headers)}));
  } catch (e) {
    throw Object.assign(new Error("sin_mac"), {codigo: "sin_mac"});
  }
  const datos = (r.headers.get("Content-Type") || "").startsWith("application/json") ? await r.json() : await r.text();
  if (!r.ok) throw Object.assign(new Error(datos && datos.error), {codigo: (datos && datos.error) || "http_" + r.status});
  return datos;
}

// Las luces y la nota se recargan cada minuto; Google, cada 3 (y al volver a la pestaña).
async function refrescar() {
  if (document.hidden) return;
  if (LOCAL) return refrescarLocal();
  if (!LLAVE) return;
  try {
    const e = await local("/estado");
    HORAS = e.horas || [];
    pintar(e.respaldo);
    pintarNota(await local("/nota"));
  } catch (err) {
    sinMac(err.codigo);
  }
  reloj();
  refrescarGoogle();
}
// Dashboard.html (file://): estado.js, nota.js y agenda.js los escriben respaldo_obsidian.sh,
// ultima_nota.py y google_agenda.py; se recargan como <script> porque file:// no deja usar fetch.
function cargar(src) {
  return new Promise(listo => {
    const s = document.createElement("script");
    s.src = src + "?" + Date.now();
    s.onload = s.onerror = () => { s.remove(); listo(); };
    document.head.appendChild(s);
  });
}
async function refrescarLocal() {
  await Promise.all(["estado", "nota", "agenda"].map(n => cargar(`scripts/${n}.js`)));
  HORAS = (window.RESPALDO && window.RESPALDO.horas) || [];
  pintar(window.RESPALDO);
  pintarNota(window.NOTA);
  if (window.AGENDA) pintarAgenda(agenda = window.AGENDA);
  reloj();
}

const esc = x => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
function hace(s) {
  const m = Math.round((Date.now() / 1000 - s) / 60);
  if (m < 1) return "hace un momento";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}
// Lo propio de Obsidian que marked no entiende: frontmatter, [[enlaces]], ![[adjuntos]] y ==resaltado==.
function deObsidian(t) {
  return t
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/!\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, (_, f) => `<span class="emb">${esc(f)}</span>`)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, a, f) => `<span class="emb">${esc(a || f)}</span>`)
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, f, a) => `<span class="wl">${esc(a)}</span>`)
    .replace(/\[\[([^\]]+)\]\]/g, (_, f) => `<span class="wl">${esc(f)}</span>`)
    .replace(/==([^=\n]+)==/g, "<mark>$1</mark>");
}

// ---------- Google ----------

const AVISOS = {
  sin_mac: "Sin conexión con el servidor de la Mac",
  llave: "La llave de este navegador ya no sirve: python3 ~/Downloads/obsidian/dashboard/scripts/servidor_local.py --llave",
  sin_cliente: "Falta el cliente web de Google: python3 ~/Downloads/obsidian/dashboard/scripts/servidor_local.py --configurar-google",
  sin_autorizar: "Falta conectar Google.",
  permiso_vencido: "Google ya no reconoce el permiso.",
  otra_cuenta: "Esa no es la cuenta del dashboard; cancelé el permiso.",
  faltan_permisos: "Faltó marcar alguna casilla de permisos.",
  sin_refresh: "Google no dio un permiso permanente.",
  codigo_invalido: "Google rechazó el código.",
  popup: "No se abrió la ventana de Google.",
  cancelado: "Se canceló el permiso de Google.",
  sin_red: "sin internet",
};
// En Dashboard.html el permiso es el de google_agenda.py (cliente de escritorio), sin botón.
const AVISOS_LOCAL = {
  sin_autorizar: "Falta conectar Google: python3 ~/Downloads/obsidian/dashboard/scripts/google_agenda.py --autorizar",
  permiso_vencido: "Venció el permiso de Google: python3 ~/Downloads/obsidian/dashboard/scripts/google_agenda.py --autorizar",
};
// Errores que se arreglan volviendo a dar el permiso (con el botón).
const RECONECTAR = ["sin_autorizar", "permiso_vencido", "otra_cuenta", "faltan_permisos", "sin_refresh",
                    "codigo_invalido", "popup", "cancelado"];
let agenda = null, cfg = null, tok = null, ultimaGoogle = 0;
const hechas = new Set();      // tareas marcadas que todavía se ven (tachadas) unos segundos
const quitar = new Map();      // id → temporizador que las quita de la lista

async function token() {
  if (!tok || tok.expira * 1000 < Date.now() + 60000) tok = await local("/google/token");
  return tok.access_token;
}
async function g(url, opciones = {}, otraVez = true) {
  let r;
  try {
    r = await fetch(url, Object.assign({}, opciones, {
      headers: Object.assign({Authorization: "Bearer " + await token()}, opciones.headers)}));
  } catch (e) {
    if (e.codigo) throw e;
    throw Object.assign(new Error("sin_red"), {codigo: "sin_red"});
  }
  if (r.status === 401 && otraVez) { tok = null; return g(url, opciones, false); }
  if (!r.ok) throw Object.assign(new Error(`Google ${r.status}`), {codigo: `Google ${r.status}`});
  return r.status === 204 ? null : r.json();
}
async function paginas(url, params) {
  const out = [];
  for (const p = Object.assign({}, params); ;) {
    const r = await g(url + "?" + new URLSearchParams(p));
    out.push(...(r.items || []));
    if (!r.nextPageToken) return out;
    p.pageToken = r.nextPageToken;
  }
}
const TASKS = "https://tasks.googleapis.com/tasks/v1";
async function traerTareas() {
  const listas = await paginas(`${TASKS}/users/@me/lists`, {maxResults: 100});
  const porLista = await Promise.all(listas.map(async l =>
    (await paginas(`${TASKS}/lists/${encodeURIComponent(l.id)}/tasks`, {showCompleted: false, showHidden: false, maxResults: 100}))
      .filter(t => (t.title || "").trim())
      .map(t => ({lista: l.title, listaId: l.id, id: t.id, titulo: t.title, notas: (t.notes || "").slice(0, 300),
                  vence: (t.due || "").slice(0, 10), padre: t.parent, pos: t.position || ""}))));
  return porLista.flat();
}
// Eventos de hoy a 7 días; solo los calendarios de config.json (en la Mac), o los visibles.
async function traerEventos(quiero) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fin = new Date(hoy); fin.setDate(fin.getDate() + 7);
  const CAL = "https://www.googleapis.com/calendar/v3";
  const cals = (await paginas(`${CAL}/users/me/calendarList`, {}))
    .filter(c => quiero.length ? quiero.includes(c.summaryOverride || c.summary || "") : c.selected);
  const evs = await Promise.all(cals.map(async c =>
    (await paginas(`${CAL}/calendars/${encodeURIComponent(c.id)}/events`, {timeMin: hoy.toISOString(),
      timeMax: fin.toISOString(), singleEvents: true, orderBy: "startTime", maxResults: 250}))
      .filter(e => e.status !== "cancelled")
      .map(e => ({titulo: e.summary || "(sin título)", lugar: e.location || "",
                  inicio: e.start.dateTime || e.start.date, fin: e.end.dateTime || e.end.date,
                  todo_el_dia: "date" in e.start}))));
  return evs.flat().sort((a, b) => a.inicio.localeCompare(b.inicio));
}
function guardarAgenda() {
  try { localStorage.setItem("agenda", JSON.stringify(agenda)); } catch (e) {}
}
async function refrescarGoogle(ya) {
  // no se recarga mientras haya tareas recién marcadas: se perdería el "deshacer"
  if (!ya && (Date.now() - ultimaGoogle < 3 * 60000 || quitar.size)) return;
  ultimaGoogle = Date.now();
  try {
    cfg = cfg || await local("/config");
    if (!cfg.client_id) throw Object.assign(new Error(), {codigo: "sin_cliente"});
    const [tareas, eventos] = await Promise.all([traerTareas(), traerEventos(cfg.calendarios || [])]);
    agenda = {actualizado: Date.now() / 1000, tareas, eventos, error: null};
    guardarAgenda();
  } catch (err) {
    agenda = Object.assign({}, agenda, {error: err.codigo || String(err)});
    if (!RECONECTAR.includes(agenda.error)) ultimaGoogle -= 2 * 60000;   // reintenta en un minuto
    if (err.codigo === "sin_mac" || err.codigo === "llave") cfg = null;
  }
  pintarAgenda(agenda);
}

// Conectar: popup de Google Identity Services (modelo de código). El código va al
// servidor de la Mac, que lo canjea, revisa que sea la cuenta correcta y guarda el permiso.
let gis = null, clienteCodigo = null;
function prepararConexion() {
  if (gis || !cfg || !cfg.client_id) return;
  gis = new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = ok; s.onerror = mal;
    document.head.appendChild(s);
  }).then(() => {
    clienteCodigo = window.google.accounts.oauth2.initCodeClient({
      client_id: cfg.client_id, scope: cfg.scopes, ux_mode: "popup", login_hint: cfg.cuenta || "",
      callback: async r => {
        if (r.error) return fallaConexion(r.error === "access_denied" ? "cancelado" : r.error);
        try {
          tok = await local("/google/conectar", {method: "POST", headers: {"Content-Type": "application/json"},
                                                 body: JSON.stringify({code: r.code})});
          refrescarGoogle(true);
        } catch (err) {
          fallaConexion(err.codigo);
        }
      },
      error_callback: () => fallaConexion("popup"),
    });
    pintarAgenda(agenda);   // quita el "Cargando Google…" del botón
  }, () => { gis = null; });
}
function fallaConexion(codigo) {
  agenda = Object.assign({}, agenda, {error: codigo});
  pintarAgenda(agenda);
}
document.addEventListener("click", ev => {
  if (!ev.target.closest(".conectar")) return;
  // requestCode tiene que ir dentro del clic para que Brave deje abrir el popup
  if (clienteCodigo) clienteCodigo.requestCode();
  else { prepararConexion(); ev.target.textContent = "Cargando Google…"; }
});

// Casilla: marca la tarea (y sus subtareas, como la app de Google) como hecha en
// Google Tasks. Se queda tachada unos segundos; otro clic en ese rato la regresa.
$("t-lista").addEventListener("click", ev => {
  const b = ev.target.closest(".circ");
  if (b && !b.disabled) marcar(b.dataset.id);
});
async function marcar(id) {
  const ts = agenda.tareas, t = ts.find(x => x.id === id);
  if (!t) return;
  const grupo = [t, ...ts.filter(s => s.padre === id)];
  const deshacer = hechas.has(id);
  clearTimeout(quitar.get(id)); quitar.delete(id);
  deshacer ? hechas.delete(id) : hechas.add(id);
  pintarAgenda(agenda);
  try {
    await Promise.all(grupo.map(x => g(`${TASKS}/lists/${encodeURIComponent(x.listaId)}/tasks/${encodeURIComponent(x.id)}`, {
      method: "PATCH", headers: {"Content-Type": "application/json"},
      body: JSON.stringify(deshacer ? {status: "needsAction", completed: null} : {status: "completed"})})));
  } catch (err) {
    deshacer ? hechas.add(id) : hechas.delete(id);
    agenda.error = RECONECTAR.includes(err.codigo) ? err.codigo : "marcar:" + err.codigo;
    return pintarAgenda(agenda);
  }
  if (deshacer) return;
  quitar.set(id, setTimeout(() => {
    quitar.delete(id); hechas.delete(id);
    const fuera = new Set(grupo.map(x => x.id));
    agenda.tareas = agenda.tareas.filter(x => !fuera.has(x.id));
    guardarAgenda();
    pintarAgenda(agenda);
  }, 3000));
}

// Clases (Google Calendar) a la izquierda y tareas (Google Tasks) a la derecha.
const h24 = d => d.toLocaleTimeString("es-MX", {hour: "2-digit", minute: "2-digit", hour12: false});
const diaClave = d => d.toLocaleDateString("sv");   // AAAA-MM-DD en hora local
function nombreDia(clave) {
  const hoy = new Date(), man = new Date(hoy);
  man.setDate(hoy.getDate() + 1);
  if (clave === diaClave(hoy)) return "hoy";
  if (clave === diaClave(man)) return "mañana";
  return new Date(clave + "T12:00").toLocaleDateString("es-MX", {weekday: "short", day: "numeric"});
}
function pintarAgenda(a) {
  if (!a) return;
  const err = a.error, aviso = (LOCAL && AVISOS_LOCAL[err]) || AVISOS[err] || err;
  const fallo = err && err.startsWith("marcar:") ? err.slice(7) : null;   // lo puso marcar()
  const reconectar = RECONECTAR.includes(err);
  const boton = !reconectar || LOCAL ? "" :
    `<button class="conectar" type="button">${err === "sin_autorizar" ? "Conectar Google" : "Volver a conectar"}</button>`;
  if (boton) prepararConexion();
  if (!a.tareas) {   // todavía no hay nada de Google: el aviso va en lugar de las listas
    $("c-tit").textContent = "Clases";
    $("c-lista").className = "aviso";
    $("t-lista").className = "tareas aviso";
    $("c-lista").innerHTML = $("t-lista").innerHTML = esc(aviso || "—") + (boton ? "<br>" + boton : "");
    $("t-cuenta").textContent = $("t-pie").textContent = "";
    return;
  }
  const ahora = new Date();

  // Clases: las de hoy; si ya terminaron todas, las del siguiente día que tenga.
  const ev = (a.eventos || []).map(e => Object.assign({}, e, {
    i: new Date(e.todo_el_dia ? e.inicio + "T00:00" : e.inicio),
    f: new Date(e.todo_el_dia ? e.fin + "T00:00" : e.fin)}));
  const dia = [...new Set(ev.map(e => diaClave(e.i)))].find(d => ev.some(e => diaClave(e.i) === d && e.f > ahora));
  const delDia = ev.filter(e => diaClave(e.i) === dia);
  // un color por materia (c0…c7 en estilo.css), por orden alfabético de las de la semana:
  // con el mismo horario cada semana, cada materia conserva su color
  const materias = [...new Set(ev.map(e => e.titulo))].sort();
  $("c-tit").textContent = dia ? `Clases · ${nombreDia(dia)}` : "Clases";
  $("c-lista").className = delDia.length ? "" : "aviso";
  $("c-lista").innerHTML = delDia.length ? delDia.map(e => {
    const cls = e.f <= ahora ? "paso" : e.i <= ahora ? "ahora" : "";
    const hora = e.todo_el_dia ? "todo el día" : `${h24(e.i)}–${h24(e.f)}`;
    return `<div class="clase ${cls} c${materias.indexOf(e.titulo) % 8}"><time>${hora}</time>` +
      `<b>${esc(e.titulo)}${e.lugar ? `<small>${esc(e.lugar)}</small>` : ""}</b></div>`;
  }).join("") : "Sin clases en los próximos 7 días.";

  // Tareas: por lista, las subtareas debajo de su tarea; primero las que vencen antes.
  const hoyK = diaClave(ahora), ts = a.tareas || [];
  const orden = (x, y) => (x.vence || "9999").localeCompare(y.vence || "9999") || x.pos.localeCompare(y.pos);
  const listas = [...new Set(ts.map(t => t.lista))];
  $("t-cuenta").textContent = ts.length || "";
  $("t-lista").className = "tareas" + (ts.length ? "" : " aviso");
  $("t-lista").innerHTML = !ts.length ? "Nada pendiente." : listas.map(l => {
    const deLista = ts.filter(t => t.lista === l);
    const raiz = deLista.filter(t => !t.padre || !deLista.some(p => p.id === t.padre)).sort(orden);
    const filas = raiz.flatMap(t => [t, ...deLista.filter(s => s.padre === t.id).sort(orden)]);
    return (listas.length > 1 ? `<div class="lista">${esc(l)}</div>` : "") + filas.map(t => {
      const c = !t.vence ? "" : t.vence < hoyK ? "tarde" : t.vence === hoyK ? "hoy" : "";
      const v = !t.vence ? "" : t.vence < hoyK ? "vencida" : nombreDia(t.vence);
      // una subtarea de una tarea recién marcada va tachada con ella y no se puede tocar sola
      const hecha = hechas.has(t.id) || hechas.has(t.padre), arrastrada = hecha && !hechas.has(t.id);
      return `<div class="tarea${raiz.includes(t) ? "" : " sub"}${hecha ? " hecha" : ""}" title="${esc(t.notas)}">` +
        `<button class="circ" type="button" role="checkbox" aria-checked="${hecha}" data-id="${esc(t.id)}"` +
        ` aria-label="${LOCAL ? "Pendiente" : hecha ? "Hecha" : "Marcar como hecha"}: ${esc(t.titulo)}"${arrastrada || LOCAL ? " disabled" : ""}></button>` +
        `<span>${esc(t.titulo)}</span><time class="${c}">${v}</time></div>`;
    }).join("");
  }).join("");
  // Lo que hay que arreglar con permiso va en rojo con su botón; lo demás, como nota.
  const rojo = reconectar || err === "sin_cliente" || err === "llave";
  $("t-pie").style.color = rojo ? "var(--rojo)" : "";
  $("t-pie").innerHTML = rojo ? esc(aviso) + boton
    : esc(`Google: ${hace(a.actualizado)}` + (fallo ? ` · no se pudo marcar (${AVISOS[fallo] || fallo})`
      : err ? ` · no se pudo actualizar (${aviso})` : ""));
}

let notaVista = "";
function pintarNota(n) {
  if (!n) return;
  $("nota").hidden = false;
  $("n-pie").textContent = `Editada ${hace(n.editada)} · ${cuando(n.editada)}` + (n.cortada ? " · vista recortada" : "");
  const clave = n.ruta + n.editada;
  if (clave === notaVista) return;   // sin cambios: no perder el scroll
  notaVista = clave;
  $("n-tit").textContent = n.titulo;
  $("n-ruta").textContent = [n.vault, n.carpeta].filter(Boolean).join(" / ");
  $("n-abrir").href = "obsidian://open?path=" + encodeURIComponent(n.ruta);
  const c = $("n-cuerpo");
  // la página tiene la llave: el HTML de la nota pasa por DOMPurify antes de entrar
  if (window.marked && window.DOMPurify) { c.style.whiteSpace = ""; c.innerHTML = DOMPurify.sanitize(marked.parse(deObsidian(n.texto))); }
  else { c.style.whiteSpace = "pre-wrap"; c.textContent = n.texto; }
}

function pintar(r) {
  if (r && r.vault) $("r-titulo").title = `~/Downloads/obsidian → vault ${r.vault}, carpeta ${r.carpeta}`;
  if (!r) { luz("l-vault", "", "—", "Todavía no hay corridas"); luz("l-nube", "", "—"); return; }

  // Luz 1: la copia llegó al vault de Cryptomator.
  const viejo = !r.ultimo_ok || Date.now() / 1000 - r.ultimo_ok > 26 * 3600;
  const archivos = (r.copiados || []).join("\n");
  if (r.estado === "error") luz("l-vault", "crit", "falló", r.mensaje);
  else if (r.estado === "cerrado") luz("l-vault", "warn", "cerrado", r.mensaje);
  else if (viejo) luz("l-vault", "warn", r.ultimo_ok ? cuando(r.ultimo_ok) : "—", "Más de un día sin copia");
  else luz("l-vault", "on", cuando(r.ultimo_ok), r.mensaje + (archivos ? "\n\n" + archivos : ""));

  // Luz 2: Google Drive ya tiene esos archivos (mismo tamaño y md5).
  const n = r.nube;
  if (!n) luz("l-nube", "", "—", "Sin verificar todavía");
  else if (n.estado === "ok") luz("l-nube", "on", cuando(n.confirmado), "Todo lo copiado está en Google con el mismo md5");
  else if (n.estado === "subiendo") luz("l-nube", "warn", "subiendo", `${n.pendientes} archivos subiendo a Drive`);
  else if (n.estado === "pendiente") luz("l-nube", "warn", `${n.pendientes} pend.`, "Drive no terminó de subirlos; se revisan en la próxima copia");
  else luz("l-nube", "crit", "no coincide", `${n.pendientes} archivos con otro contenido en Google`);
}
// Sin servidor (o con la llave vieja): luces apagadas con el motivo en el tooltip.
function sinMac(codigo) {
  const msg = AVISOS[codigo] || codigo;
  luz("l-vault", "", "—", msg);
  luz("l-nube", "", "—", msg);
}

// La bitácora del respaldo, en otra pestaña (el enlace no puede llevar la llave).
$("r-log").addEventListener("click", async ev => {
  if (LOCAL) return;   // en Dashboard.html el enlace abre scripts/respaldo.log directo
  ev.preventDefault();
  if (!LLAVE) return;
  const w = window.open("", "_blank");   // dentro del clic, para que no la bloquee Brave
  if (!w) return;
  w.document.title = "Bitácora del respaldo";
  const pre = w.document.body.appendChild(w.document.createElement("pre"));
  pre.textContent = "Cargando…";
  try {
    pre.textContent = await local("/bitacora");
  } catch (err) {
    pre.textContent = AVISOS[err.codigo] || err.codigo;
  }
});

// Arranque: con la llave, lo último de Google que vio este navegador se pinta
// mientras llega lo nuevo.
if (LLAVE) {
  try { agenda = JSON.parse(localStorage.getItem("agenda")); } catch (e) {}
  pintarAgenda(agenda);
}
if (LOCAL) $("r-log").href = "scripts/respaldo.log";
if (LLAVE || LOCAL) {
  refrescar(); setInterval(refrescar, 60000);
  document.addEventListener("visibilitychange", refrescar);
}
