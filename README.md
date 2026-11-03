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

## Dónde vive en la Mac

```
~/Downloads/obsidian/dashboard/   dentro de las bóvedas, así se respalda con ellas
├── Dashboard.html   página de inicio local (la genera scripts/dashboard_local.py)
├── web/             este repositorio
├── scripts/         servidor local, respaldo, nota y agenda, con sus datos (no están aquí)
└── docs/            brief, diagramas y el favicon original
```

Las rutas de los scripts salen de `scripts/rutas.py`, y los agentes de launchd le pasan a
`RespaldoObsidian.app` la ruta del script, así que mover la carpeta no obliga a recompilar.

## Cómo funciona

### 1. El panorama

```mermaid
flowchart LR
  subgraph MAC["Mi Mac"]
    direction TB
    VAULT[("Bóvedas de Obsidian<br/>~/Downloads/obsidian")]
    subgraph LD["launchd, vía RespaldoObsidian.app (permiso de Descargas)"]
      RESP["com.paul.respaldo-obsidian<br/>10, 14, 18 y 22 h"]
      SERV["com.paul.dashboard-local<br/>siempre prendido"]
    end
    SH["respaldo_obsidian.sh"]
    PYS["servidor_local.py<br/>127.0.0.1:47863"]
    DATA["dashboard/scripts<br/>estado.js · nota.js · agenda.js"]
    CONF[("~/.config/obsidian-dashboard<br/>llave · cliente_web.json · token_web.json<br/>token.json · config.json")]
    REPO["dashboard/web<br/>clon del repositorio"]
    LOCAL["dashboard/Dashboard.html<br/>file://, modo local"]
  end
  subgraph NUBE["Internet"]
    GH["GitHub<br/>paul-rz/dashboard, solo código"]
    PAGES["GitHub Pages + CDN<br/>dashboard.paulr.xyz"]
    CF["Cloudflare DNS<br/>CNAME dashboard → paul-rz.github.io"]
    GOOG["Google<br/>Tasks · Calendar · OAuth"]
    CRYP["Cryptomator → Google Drive"]
  end
  BRAVE(["Brave"])

  RESP --> SH
  SERV --> SH
  SH -->|"MODO=servidor"| PYS
  SH -->|"rclone"| CRYP
  SH --> DATA
  VAULT --> SH
  VAULT -.->|"última nota"| PYS
  DATA --> PYS
  CONF --- PYS
  PYS -->|"refresh token"| GOOG
  REPO -->|"git push"| GH
  GH --> PAGES
  CF --> PAGES
  REPO -->|"dashboard_local.py"| LOCAL
  DATA --> LOCAL
  BRAVE -->|"https"| PAGES
  BRAVE -->|"fetch con llave"| PYS
  BRAVE -->|"token de 1 h"| GOOG
  BRAVE -->|"file://"| LOCAL
```

### 2. Qué pasa al abrir dashboard.paulr.xyz

```mermaid
sequenceDiagram
  autonumber
  participant B as Brave
  participant P as GitHub Pages
  participant S as servidor_local.py (127.0.0.1)
  participant G as Google APIs
  B->>P: GET index.html, estilo.css?v=…, app.js?v=…
  P-->>B: archivos estáticos, sin datos
  Note over B: llave.js revisa si hay llave en localStorage
  alt sin llave (cualquier otra computadora)
    Note over B: solo reloj y buscador
  else con llave (mi Mac)
    B->>S: OPTIONS (preflight de red privada)
    S-->>B: 204 si el Origin es https://dashboard.paulr.xyz
    B->>S: GET /estado y /nota con Authorization Bearer llave
    S-->>B: luces del respaldo y última nota
    B->>S: GET /google/token
    S->>G: refresh_token a cambio de access_token
    S-->>B: token de 1 hora
    B->>G: Tasks y Calendar, directo desde el navegador
    G-->>B: tareas y clases
  end
```

### 3. Conectar Google (una sola vez)

```mermaid
sequenceDiagram
  participant U as Yo
  participant B as Brave (dashboard)
  participant A as Google
  participant S as servidor_local.py
  U->>B: clic en «Conectar Google»
  B->>A: popup de Google Identity Services (modelo de código)
  U->>A: elijo mi cuenta y doy Permitir
  A-->>B: código de un solo uso
  B->>S: POST /google/conectar con el código y la llave
  S->>A: canjea el código con el secreto del cliente web
  A-->>S: refresh_token e id_token
  S->>S: revisa que el correo sea el de config.json (solo en la Mac)
  alt es otra cuenta
    S->>A: revoca el permiso y lo rechaza
  else es mi cuenta
    S->>S: guarda token_web.json (permisos 600)
  end
  Note over S,A: la app está En producción: el permiso ya no vence a los 7 días
```

### 4. La casilla de una tarea

```mermaid
sequenceDiagram
  participant U as Yo
  participant B as Brave
  participant G as Google Tasks
  U->>B: clic en el círculo
  B->>B: la tacha (con sus subtareas)
  B->>G: PATCH status completed
  alt otro clic antes de 3 s
    B->>G: PATCH status needsAction (deshacer)
  else pasan 3 s
    B->>B: la quita de la lista
  end
```

### 5. Cómo se protege el servidor local

```mermaid
flowchart TD
  R["Petición a 127.0.0.1:47863"] --> H{"¿Host es 127.0.0.1?"}
  H -->|no| X1["403: protege contra DNS rebinding"]
  H -->|sí| O{"¿Origin es exactamente https://dashboard.paulr.xyz?"}
  O -->|no| X2["403: otra página no puede leer los datos"]
  O -->|sí| T{"¿Es el preflight OPTIONS?"}
  T -->|sí| OK1["204 con CORS y Allow-Private-Network"]
  T -->|no| K{"¿Trae la llave correcta?"}
  K -->|no| X3["401"]
  K -->|sí| RUTA["/estado · /nota · /bitacora · /config<br/>/google/token · /google/conectar"]
```

La llave es aleatoria y vive en `~/.config/obsidian-dashboard/llave` y en el localStorage de mi
Brave. Si se borran los datos del sitio, se crea otra con
`python3 ~/Downloads/obsidian/dashboard/scripts/servidor_local.py --llave`.

### 6. Un solo código para las dos páginas

```mermaid
flowchart LR
  subgraph R["dashboard/web, el repositorio"]
    I["index.html"]
    C["estilo.css"]
    J["app.js · llave.js"]
  end
  I -->|"dashboard_local.py"| L["Dashboard.html<br/>data-modo=local"]
  C -.->|"file://"| L
  J -.->|"file://"| L
  L -->|"lee"| D["scripts/estado.js · nota.js · agenda.js<br/>tareas en solo lectura"]
  I -->|"versionar.py, commit y push"| W["dashboard.paulr.xyz"]
  C -.->|"?v=marca"| W
  J -.->|"?v=marca"| W
  W -->|"fetch con llave"| S["servidor_local.py<br/>tareas con casilla"]
```

Si cambia `estilo.css` o `app.js`, el local cambia al recargar y la web cuando se sube.
`dashboard_local.py` solo hay que volver a correrlo si cambia `index.html`.

### 7. Cómo se publica

```mermaid
flowchart LR
  E["Cambio en dashboard/web"] --> V["versionar.py<br/>marca ?v= por contenido"]
  V --> C["commit como paul-rz<br/>sin trailer"]
  C --> P["git push a main"]
  P --> B["GitHub Pages publica"]
  DNS["Cloudflare: CNAME dashboard → paul-rz.github.io<br/>DNS only"] --> B
  VER["TXT _github-pages-challenge-paul-rz<br/>paulr.xyz verificado: nadie más lo usa en Pages"] --> B
  B --> HTTPS["Certificado de Let's Encrypt<br/>HTTPS forzado"]
```

### Dónde vive cada cosa

| Qué | Dónde | ¿En GitHub? |
|---|---|---|
| Página, estilo y lógica | `dashboard/web` → `paul-rz/dashboard` | Sí, solo código |
| Inicio y privacidad para Google | `acerca.html`, `privacidad.html` | Sí |
| Servidor local | `~/Downloads/obsidian/dashboard/scripts/servidor_local.py` | No |
| Agente que lo deja prendido | `~/Library/LaunchAgents/com.paul.dashboard-local.plist` | No |
| Llave, secreto del cliente web y permisos de Google | `~/.config/obsidian-dashboard/` (600) | **Nunca** |
| Datos del respaldo, nota y agenda | `~/Downloads/obsidian/dashboard/scripts/*.js` | **Nunca** |
| Página local | `~/Downloads/obsidian/dashboard/Dashboard.html` (la genera `dashboard_local.py`) | No |

**Google Cloud**: la app "Obsidian dashboard" está
**En producción**, con inicio, privacidad y el dominio `paulr.xyz` en Branding. Tiene dos clientes:
`dashboard-mac` (escritorio, para el `Dashboard.html` local, solo lectura) y `dashboard-web`
(aplicación web, para la casilla real).
