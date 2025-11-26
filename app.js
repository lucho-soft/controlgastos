const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));

// Configuración de subida de archivos para restore
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// CSS embebido
const baseStyles = `
  <style>
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      margin: 0; padding: 0;
      background: #f2f4f7; color: #222;
    }
    a { color:#1e88e5; text-decoration:none; }
    a:hover { text-decoration:underline; }

    .navbar {
      background:#1e88e5; color:white;
      padding:14px 24px;
      display:flex; justify-content:space-between; align-items:center;
    }
    .navbar h1 { margin:0; font-size:1.4rem; }
    .navbar nav a { color:white; margin-left:16px; font-size:0.9rem; }

    .container { max-width:1100px; margin:0 auto; padding:24px; }

    .section-title {
      font-size:1.3rem; margin-top:32px; margin-bottom:12px;
      border-left:4px solid #1e88e5;
      padding-left:10px; color:#333;
    }

    .cards {
      display:flex; flex-wrap:wrap; gap:16px;
    }
    .card {
      background:white; flex:1 1 260px;
      padding:16px; border-radius:10px;
      box-shadow:0 2px 8px rgba(0,0,0,.06);
    }
    .card h3 { margin-top:0; }
    .amount { font-size:1.6rem; font-weight:bold; }
    .positive { color:#2e7d32; }
    .negative { color:#c62828; }
    .neutral { color:#616161; }
    .small { font-size:0.8rem; color:#666; }

    table {
      width:100%; border-collapse:collapse;
      background:white; border-radius:8px;
      overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.05);
      font-size:0.9rem;
    }
    th {
      background:#e3f2fd; padding:10px;
      text-align:left; font-weight:600; color:#444;
    }
    td { padding:10px; border-bottom:1px solid #eee; }
    tr:nth-child(even) td { background:#fafafa; }

    .tag {
      padding:4px 8px; border-radius:6px;
      font-size:0.8rem; font-weight:600;
      display:inline-block;
    }
    .tag-in { background:#e8f4ff; color:#1e88e5; }
    .tag-out { background:#ffebee; color:#c62828; }
    .tag-emilse { background:#e8f5e9; color:#2e7d32; }
    .tag-depto { background:#fff3e0; color:#ef6c00; }

    .form-box {
      background:white; padding:20px; border-radius:10px;
      margin-top:16px; box-shadow:0 2px 8px rgba(0,0,0,.05);
    }
    .form-row { display:flex; flex-wrap:wrap; gap:16px; margin-bottom:12px; }
    .form-field { flex:1 1 200px; display:flex; flex-direction:column; }

    label { font-size:0.85rem; margin-bottom:4px; }

    input, select, textarea {
      padding:8px; border-radius:6px;
      border:1px solid #ccc; font-size:0.9rem;
    }
    textarea { min-height:60px; }

    button {
      background:#1e88e5; color:white;
      padding:10px 20px; border:none;
      border-radius:6px; cursor:pointer;
      margin-top:10px; font-size:0.9rem;
    }
    button:hover { background:#1565c0; }

    .flash {
      background:#E8F5E9; border:1px solid #C8E6C9;
      padding:10px; border-radius:6px;
      color:#2E7D32; margin-bottom:20px;
      font-size:0.9rem;
    }

    .bar-h-container {
      width:260px; height:12px;
      background:#e0e0e0; border-radius:999px; overflow:hidden;
    }
    .bar-h {
      height:100%; border-radius:999px;
    }
    .bar-positive-h { background:#2e7d32; }
    .bar-negative-h { background:#c62828; }
    .bar-zero-h { background:#9e9e9e; }
  </style>
`;

// ---- BASE DE DATOS ----
const dbFile = path.join(__dirname, "familia-emilse.db");
const db = new Database(dbFile);
db.pragma("journal_mode = WAL");

function initDb() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS contributors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      contributor_id INTEGER NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('IN','OUT')),
      category TEXT NOT NULL CHECK(category IN ('EMILSE','DEPTO')),
      description TEXT,
      amount_local REAL NOT NULL,
      currency TEXT NOT NULL,
      fx_to_usd REAL NOT NULL,
      amount_usd REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contributor_id) REFERENCES contributors(id)
    )
  `).run();

  const ins = db.prepare("INSERT OR IGNORE INTO contributors (name) VALUES (?)");
  ["Gerardo", "Néstor", "Leandro", "Emilse"].forEach((n) => ins.run(n));
}
initDb();

function getContributors() {
  return db.prepare("SELECT * FROM contributors ORDER BY id").all();
}
function getMovements() {
  // más reciente primero
  return db.prepare(`
    SELECT m.*, c.name AS contributor_name
    FROM movements m
    JOIN contributors c ON c.id = m.contributor_id
    ORDER BY date DESC, m.id DESC
  `).all();
}

// ---- CÁLCULO RESUMEN ----
function computeSummary() {
  const contributors = getContributors();
  const movements = getMovements();

  const aportes = {};
  contributors.forEach((c) => (aportes[c.id] = 0));

  let totalGastosEmilse = 0;
  let ajusteGerardo = 0;

  const gerardo = contributors.find((c) => c.name === "Gerardo");
  const gerardoId = gerardo?.id ?? null;

  const emilse = contributors.find((c) => c.name === "Emilse");
  const emilseId = emilse?.id ?? null;

  for (const m of movements) {
    if (m.direction === "IN") {
      aportes[m.contributor_id] += m.amount_usd;
    } else if (m.direction === "OUT") {
      if (m.category === "EMILSE") {
        totalGastosEmilse += m.amount_usd;
      } else if (m.category === "DEPTO" && gerardoId && m.contributor_id === gerardoId) {
        // Gasto del depto pagado con la bolsa → baja Gerardo
        ajusteGerardo -= m.amount_usd;
      }
    }
  }

  if (gerardoId) aportes[gerardoId] += ajusteGerardo;

  const aportesEmilse = emilseId ? (aportes[emilseId] || 0) : 0;

  let gastosParaHermanos = totalGastosEmilse - aportesEmilse;
  if (gastosParaHermanos < 0) gastosParaHermanos = 0;

  const hermanos = contributors.filter((c) =>
    ["Gerardo", "Néstor", "Leandro"].includes(c.name)
  );
  const cantHermanos = hermanos.length || 1;

  const equalShare = gastosParaHermanos / cantHermanos;

  let totalNet = 0;
  hermanos.forEach((h) => (totalNet += aportes[h.id] || 0));
  const avgNet = totalNet / cantHermanos;

  const resumenHermanos = hermanos.map((h) => ({
    id: h.id,
    name: h.name,
    aport: aportes[h.id] || 0,
    saldoPozo: (aportes[h.id] || 0) - equalShare,
    diffEquidad: (aportes[h.id] || 0) - avgNet,
  }));

  return {
    contributors,
    movements,
    aportNet: aportes,
    resumenHermanos,
    totalGastosEmilse,
    aportesEmilse,
    gastosParaHermanos,
    equalShare,
    avgNet,
    movsEmilse: movements.filter((m) => m.category === "EMILSE"),
    movsDepto: movements.filter((m) => m.category === "DEPTO"),
  };
}

// ---- RENDER BASE ----
function renderPage({ title, content }) {
  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>${title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        ${baseStyles}
      </head>
      <body>
        <div class="navbar">
          <h1>Cuenta Familiar - Emilse</h1>
          <nav>
            <a href="/">Hermanos</a>
            <!-- /admin existe pero sin link directo -->
          </nav>
        </div>
        <div class="container">
          ${content}
        </div>
      </body>
    </html>
  `;
}

// ---- PÁGINA HERMANOS ----
app.get("/", (req, res) => {
  const s = computeSummary();

  const cardsAportes = s.contributors
    .map(
      (c) => `
      <div class="card">
        <h3>${c.name}</h3>
        <div class="amount neutral">${(s.aportNet[c.id] || 0).toFixed(2)} USD</div>
        <p class="small">Aportes netos al pozo (ajustados).</p>
      </div>`
    )
    .join("");

  const cardsBalance = s.resumenHermanos
    .map((r) => {
      const cls = r.saldoPozo > 0 ? "positive" : r.saldoPozo < 0 ? "negative" : "neutral";
      const sign = r.saldoPozo >= 0 ? "+" : "";
      return `
        <div class="card">
          <h3>${r.name}</h3>
          <div class="amount ${cls}">${sign}${r.saldoPozo.toFixed(2)} USD</div>
          <p class="small">Saldo después del reparto justo.</p>
        </div>`;
    })
    .join("");

  let maxAbs = 1;
  s.resumenHermanos.forEach((r) => {
    const abs = Math.abs(r.diffEquidad);
    if (abs > maxAbs) maxAbs = abs;
  });

  const rowsDiff = s.resumenHermanos
    .map((r) => {
      const pct = Math.max(5, Math.round((Math.abs(r.diffEquidad) * 100) / maxAbs));
      const cls =
        r.diffEquidad > 0 ? "bar-positive-h" :
        r.diffEquidad < 0 ? "bar-negative-h" : "bar-zero-h";
      const txt =
        r.diffEquidad > 0 ? "Puso de más (podría recibir)" :
        r.diffEquidad < 0 ? "Puso de menos (podría aportar)" :
        "En línea con el promedio";

      return `
        <tr>
          <td>${r.name}</td>
          <td>${r.diffEquidad.toFixed(2)} USD</td>
          <td>
            <div class="bar-h-container">
              <div class="bar-h ${cls}" style="width:${pct}%;"></div>
            </div>
          </td>
          <td>${txt}</td>
        </tr>`;
    })
    .join("");

  const tablaMovimientos = (movs) =>
    movs.length === 0
      ? "<p class='small'>No hay movimientos registrados.</p>"
      : `
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Persona</th>
            <th>Tipo</th>
            <th>Categoría</th>
            <th>Monto local</th>
            <th>TC → USD</th>
            <th>Monto USD</th>
            <th>Descripción</th>
          </tr>
        </thead>
        <tbody>
          ${movs
            .map((m) => {
              const tipo =
                m.direction === "IN"
                  ? '<span class="tag tag-in">Ingreso</span>'
                  : '<span class="tag tag-out">Egreso</span>';
              const cat =
                m.category === "EMILSE"
                  ? '<span class="tag tag-emilse">Emilse</span>'
                  : '<span class="tag tag-depto">Depto Gerardo</span>';

              return `
              <tr>
                <td>${m.date}</td>
                <td>${m.contributor_name}</td>
                <td>${tipo}</td>
                <td>${cat}</td>
                <td>${m.amount_local.toFixed(2)} ${m.currency}</td>
                <td>${m.fx_to_usd.toFixed(4)}</td>
                <td>${m.amount_usd.toFixed(2)}</td>
                <td>${m.description || ""}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>`;

  const content = `
    <h2 class="section-title">Aportes netos</h2>
    <div class="cards">${cardsAportes}</div>

    <h2 class="section-title">Balance entre hermanos</h2>
    <div class="cards">${cardsBalance}</div>

    <h2 class="section-title">Diferencias respecto al promedio</h2>
    <table>
      <thead>
        <tr>
          <th>Hermano</th>
          <th>Diferencia</th>
          <th>Gráfico</th>
          <th>Comentario</th>
        </tr>
      </thead>
      <tbody>
        ${rowsDiff}
      </tbody>
    </table>

    <h2 class="section-title">Datos generales</h2>
    <div class="card">
      <p>Total gastos Emilse: <b>${s.totalGastosEmilse.toFixed(2)} USD</b></p>
      <p>Aportes Emilse: <b>${s.aportesEmilse.toFixed(2)} USD</b></p>
      <p>Gastos a cubrir entre hermanos: <b>${s.gastosParaHermanos.toFixed(2)} USD</b></p>
      <p>Parte justa por hermano: <b>${s.equalShare.toFixed(2)} USD</b></p>
    </div>

    <h2 class="section-title">Movimientos - Emilse</h2>
    ${tablaMovimientos(s.movsEmilse)}

    <h2 class="section-title">Movimientos - Depto Gerardo</h2>
    ${tablaMovimientos(s.movsDepto)}
  `;

  res.send(renderPage({ title: "Panel hermanos", content }));
});

// ---- PANEL ADMIN ----
app.get("/admin", (req, res) => {
  const s = computeSummary();
  const contributors = s.contributors;
  const today = new Date().toISOString().slice(0, 10);

  const optionsContributors = contributors
    .map((c) => `<option value="${c.id}">${c.name}</option>`)
    .join("");

  const tablaMovAdmin = (movs) =>
    movs.length === 0
      ? "<p class='small'>No hay movimientos.</p>"
      : `
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Persona</th>
            <th>Tipo</th>
            <th>Categoría</th>
            <th>Monto local</th>
            <th>TC → USD</th>
            <th>Monto USD</th>
            <th>Descripción</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${movs
            .map((m) => {
              const tipo =
                m.direction === "IN"
                  ? '<span class="tag tag-in">Ingreso</span>'
                  : '<span class="tag tag-out">Egreso</span>';
              const cat =
                m.category === "EMILSE"
                  ? '<span class="tag tag-emilse">Emilse</span>'
                  : '<span class="tag tag-depto">Depto Gerardo</span>';

              return `
              <tr>
                <td>${m.date}</td>
                <td>${m.contributor_name}</td>
                <td>${tipo}</td>
                <td>${cat}</td>
                <td>${m.amount_local.toFixed(2)} ${m.currency}</td>
                <td>${m.fx_to_usd.toFixed(4)}</td>
                <td>${m.amount_usd.toFixed(2)}</td>
                <td>${m.description || ""}</td>
                <td>
                  <form method="POST" action="/admin/movements/${m.id}/delete"
                        onsubmit="return confirm('¿Eliminar este movimiento?');">
                    <button style="background:#c62828; padding:4px 10px;">X</button>
                  </form>
                </td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>`;

  const content = `
    <div class="flash">
      Panel admin (acceso manual /admin). No compartas esta URL con los hermanos.
    </div>

    <h2 class="section-title">Backup</h2>
    <div class="card">
      <p>Podés descargar una copia completa de la base de datos actual o restaurar desde un archivo.</p>
      <a href="/admin/backup">
        <button>📥 Descargar base de datos</button>
      </a>
      <hr />
      <form method="POST" action="/admin/restore" enctype="multipart/form-data">
        <label for="dbfile">Restaurar base desde archivo (.sqlite / .db)</label>
        <input type="file" id="dbfile" name="dbfile" accept=".sqlite,.db,.sqlite3" required />
        <p class="small">
          Antes de sobrescribir se guardará una copia de seguridad de la base actual en el servidor.
          Después de restaurar, conviene reiniciar el servicio en Render para que tome la base nueva.
        </p>
        <button type="submit" style="background:#6a1b9a;">🔁 Restaurar base</button>
      </form>
    </div>

    <h2 class="section-title">Nuevo movimiento</h2>
    <form class="form-box" method="POST" action="/admin/movements">
      <div class="form-row">
        <div class="form-field">
          <label>Fecha</label>
          <input type="date" name="date" value="${today}" required />
        </div>
        <div class="form-field">
          <label>Persona</label>
          <select name="contributor_id" required>
            ${optionsContributors}
          </select>
        </div>
        <div class="form-field">
          <label>Tipo</label>
          <select name="direction" required>
            <option value="IN">Ingreso</option>
            <option value="OUT">Egreso</option>
          </select>
        </div>
        <div class="form-field">
          <label>Categoría</label>
          <select name="category" required>
            <option value="EMILSE">Emilse (gastos geriátrico, etc.)</option>
            <option value="DEPTO">Depto Gerardo</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label>Monto en moneda local</label>
          <input type="number" step="0.01" name="amount_local" required />
        </div>
        <div class="form-field">
          <label>Moneda</label>
          <input type="text" name="currency" value="ARS" required />
        </div>
        <div class="form-field">
          <label>Tipo de cambio → USD</label>
          <input type="number" step="0.0001" name="fx_to_usd" required />
          <span class="small">
            Monto local / este valor = monto en USD.
          </span>
        </div>
      </div>

      <label>Descripción</label>
      <textarea name="description" placeholder="Ej: Pago mes geriátrico, expensas depto, etc."></textarea>

      <button type="submit">Guardar movimiento</button>
    </form>

    <h2 class="section-title">Movimientos - Emilse</h2>
    ${tablaMovAdmin(s.movsEmilse)}

    <h2 class="section-title">Movimientos - Depto Gerardo</h2>
    ${tablaMovAdmin(s.movsDepto)}
  `;

  res.send(renderPage({ title: "Admin", content }));
});

// ---- Crear movimiento ----
app.post("/admin/movements", (req, res) => {
  const {
    date,
    contributor_id,
    direction,
    category,
    description,
    amount_local,
    currency,
    fx_to_usd,
  } = req.body;

  const local = parseFloat(amount_local);
  const fx = parseFloat(fx_to_usd);
  if (!local || !fx) {
    return res.status(400).send("Monto y tipo
