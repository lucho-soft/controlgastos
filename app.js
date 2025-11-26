const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para leer formularios
app.use(express.urlencoded({ extended: true }));

// CSS embebido
const baseStyles = `
  <style>
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 0;
      background: #f2f4f7;
      color: #222;
    }
    a { color: #1e88e5; text-decoration: none; }
    a:hover { text-decoration: underline; }

    .navbar {
      background: #1e88e5;
      color: white;
      padding: 14px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .navbar h1 {
      margin: 0;
      font-size: 1.4rem;
    }
    .navbar nav a {
      color: white;
      margin-left: 16px;
      font-size: 0.95rem;
      opacity: 0.95;
    }
    .navbar nav a:hover { opacity: 1; }

    .container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px;
    }

    .section-title {
      font-size: 1.3rem;
      margin-top: 32px;
      margin-bottom: 12px;
      border-left: 4px solid #1e88e5;
      padding-left: 10px;
      color: #333;
    }

    .cards {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }
    .card {
      background: white;
      flex: 1 1 260px;
      padding: 16px;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,.06);
    }
    .card h3 {
      margin-top: 0;
      margin-bottom: 6px;
      color: #444;
    }
    .card .amount {
      font-size: 1.6rem;
      font-weight: bold;
    }
    .positive { color: #2e7d32; }
    .negative { color: #c62828; }
    .neutral  { color: #616161; }

    .small {
      font-size: 0.8rem;
      color: #666;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,.05);
      font-size: 0.9rem;
    }
    th {
      background: #e3f2fd;
      padding: 10px;
      font-weight: 600;
      color: #444;
      text-align: left;
    }
    td {
      padding: 10px;
      border-bottom: 1px solid #eee;
    }
    tr:nth-child(even) td {
      background: #fafafa;
    }

    .tag {
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .tag-in { background:#e8f4ff; color:#1e88e5; }
    .tag-out { background:#ffebee; color:#c62828; }
    .tag-emilse { background:#e8f5e9; color:#2e7d32; }
    .tag-depto { background:#fff3e0; color:#ef6c00; }

    .form-box {
      background:white;
      padding: 20px;
      border-radius:10px;
      box-shadow:0 2px 8px rgba(0,0,0,.05);
      margin-top: 16px;
    }
    .form-row {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 12px;
    }
    .form-field {
      flex: 1 1 200px;
      display:flex;
      flex-direction:column;
    }
    label { font-size:0.85rem; margin-bottom:4px; }
    input, select, textarea {
      padding: 8px;
      font-size: 0.9rem;
      border:1px solid #ccc;
      border-radius:6px;
    }
    textarea { min-height: 60px; }

    button {
      background:#1e88e5;
      color:white;
      padding:10px 20px;
      border:none;
      border-radius:6px;
      margin-top:10px;
      cursor:pointer;
      font-size:0.9rem;
    }
    button:hover { background:#1565c0; }

    .flash {
      background:#E8F5E9;
      border:1px solid #C8E6C9;
      padding:10px;
      border-radius:6px;
      color:#2E7D32;
      margin-bottom:20px;
      font-size: 0.9rem;
    }

    .bar-h-container {
      width: 260px;
      height: 12px;
      background: #e0e0e0;
      border-radius: 999px;
      overflow: hidden;
    }
    .bar-h {
      height: 100%;
      border-radius: 999px;
    }
    .bar-positive-h { background:#2e7d32; }
    .bar-negative-h { background:#c62828; }
    .bar-zero-h { background:#9e9e9e; }
  </style>
`;

// ---- Base de datos SQLite con better-sqlite3 ----
const dbFile = path.join(__dirname, "familia-emilse.db");
const db = new Database(dbFile);
db.pragma("journal_mode = WAL");

// Inicializar schema y datos
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

  const insertContributor = db.prepare(
    "INSERT OR IGNORE INTO contributors (name) VALUES (?)"
  );
  ["Gerardo", "Néstor", "Leandro", "Emilse"].forEach((name) =>
    insertContributor.run(name)
  );
}

initDb();

// Helpers DB
function getContributors() {
  return db.prepare("SELECT * FROM contributors ORDER BY id").all();
}

function getMovements() {
  return db
    .prepare(
      `SELECT m.*, c.name AS contributor_name
       FROM movements m
       JOIN contributors c ON c.id = m.contributor_id
       ORDER BY date ASC, m.id ASC`
    )
    .all();
}

// Render base
function renderPage({ title, content, isAdmin }) {
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
          </nav>
        </div>
        <div class="container">
          ${content}
        </div>
      </body>
    </html>
  `;
}

// ---- Cálculos de resumen ----
function computeSummary() {
  const contributors = getContributors();
  const movements = getMovements();

  const aportes = {};
  contributors.forEach((c) => {
    aportes[c.id] = 0;
  });

  let totalGastosEmilse = 0;
  let ajusteGerardo = 0;

  const gerardo = contributors.find(
    (c) => c.name.toLowerCase().startsWith("gerardo")
  );
  const gerardoId = gerardo ? gerardo.id : null;

  for (const m of movements) {
    if (m.direction === "IN") {
      aportes[m.contributor_id] += m.amount_usd;
    } else if (m.direction === "OUT") {
      if (m.category === "EMILSE") {
        totalGastosEmilse += m.amount_usd;
      } else if (m.category === "DEPTO" && gerardoId && m.contributor_id === gerardoId) {
        // Gasto de depto pagado con la bolsa => baja Gerardo
        ajusteGerardo -= m.amount_usd;
      }
    }
  }

  if (gerardoId) {
    aportes[gerardoId] += ajusteGerardo;
  }

  const hermanos = contributors.filter((c) =>
    ["Gerardo", "Néstor", "Leandro"].includes(c.name)
  );
  const cantHermanos = hermanos.length || 1;

  const equalShare = totalGastosEmilse / cantHermanos;

  let totalNetHermanos = 0;
  hermanos.forEach((h) => {
    totalNetHermanos += aportes[h.id] || 0;
  });
  const avgNet = totalNetHermanos / cantHermanos;

  const resumenHermanos = hermanos.map((h) => {
    const ap = aportes[h.id] || 0;
    const saldoPozo = ap - equalShare;
    const diffEquidad = ap - avgNet;
    return {
      id: h.id,
      name: h.name,
      aport: ap,
      saldoPozo,
      diffEquidad,
    };
  });

  const movsEmilse = movements.filter((m) => m.category === "EMILSE");
  const movsDepto = movements.filter((m) => m.category === "DEPTO");

  return {
    contributors,
    movements,
    aportNet: aportes,
    resumenHermanos,
    totalGastosEmilse,
    equalShare,
    avgNet,
    movsEmilse,
    movsDepto,
  };
}

// Tabla movimientos
function movimientosTableHtml(movs, { isAdmin = false } = {}) {
  if (!movs || movs.length === 0) {
    return `<p class="small">No hay movimientos registrados todavía.</p>`;
  }

  const thAcc = isAdmin ? "<th>Acciones</th>" : "";

  const rows = movs
    .map((m) => {
      const tagDir =
        m.direction === "IN"
          ? '<span class="tag tag-in">Ingreso</span>'
          : '<span class="tag tag-out">Egreso</span>';
      const tagCat =
        m.category === "EMILSE"
          ? '<span class="tag tag-emilse">Emilse</span>'
          : '<span class="tag tag-depto">Depto Gerardo</span>';

      const acc = isAdmin
        ? `
        <td>
          <form method="POST" action="/admin/movements/${m.id}/delete"
                onsubmit="return confirm('¿Seguro que querés borrar este movimiento?');">
            <button type="submit" style="background:#c62828; padding:4px 10px; font-size:0.8rem; margin:0;">
              Eliminar
            </button>
          </form>
        </td>`
        : "";

      return `
        <tr>
          <td>${m.date}</td>
          <td>${m.contributor_name}</td>
          <td>${tagDir}</td>
          <td>${tagCat}</td>
          <td>${m.amount_local.toFixed(2)} ${m.currency}</td>
          <td>${m.fx_to_usd.toFixed(4)}</td>
          <td>${m.amount_usd.toFixed(2)} USD</td>
          <td>${m.description || ""}</td>
          ${acc}
        </tr>
      `;
    })
    .join("");

  return `
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
          ${thAcc}
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

// ---- Rutas ----

// Panel hermanos (lectura)
app.get("/", (req, res) => {
  try {
    const summary = computeSummary();

    const cardsAportes = summary.contributors
      .map((c) => {
        const net = summary.aportNet[c.id] || 0;
        return `
          <div class="card">
            <h3>${c.name}</h3>
            <div class="amount neutral">${net.toFixed(2)} USD</div>
            <p class="small">Aportes netos al pozo de Emilse.</p>
          </div>
        `;
      })
      .join("");

    const cardsBalance = summary.resumenHermanos
      .map((r) => {
        const saldo = r.saldoPozo;
        const cls = saldo > 0 ? "positive" : saldo < 0 ? "negative" : "neutral";
        const sign = saldo >= 0 ? "+" : "";
        return `
          <div class="card">
            <h3>${r.name}</h3>
            <div class="amount ${cls}">${sign}${saldo.toFixed(2)} USD</div>
            <p class="small">
              Aportes netos totales: ${r.aport.toFixed(2)} USD<br>
              Saldo luego de repartir gastos de Emilse.
            </p>
          </div>
        `;
      })
      .join("");

    // tabla de diferencias vs promedio
    let maxAbs = 0;
    summary.resumenHermanos.forEach((r) => {
      const abs = Math.abs(r.diffEquidad);
      if (abs > maxAbs) maxAbs = abs;
    });
    if (maxAbs === 0) maxAbs = 1;

    const rowsDiff = summary.resumenHermanos
      .map((r) => {
        const diff = r.diffEquidad;
        const abs = Math.abs(diff);
        const pct = Math.max(5, Math.round((abs * 100) / maxAbs));
        let cls = "bar-zero-h";
        let txt = "En línea con el promedio";
        if (diff > 0) {
          cls = "bar-positive-h";
          txt = "Puso de más (podría recibir)";
        } else if (diff < 0) {
          cls = "bar-negative-h";
          txt = "Puso de menos (podría poner)";
        }
        const diffTxt = `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}`;
        return `
          <tr>
            <td>${r.name}</td>
            <td>${diffTxt} USD</td>
            <td>
              <div class="bar-h-container">
                <div class="bar-h ${cls}" style="width:${pct}%;"></div>
              </div>
            </td>
            <td>${txt}</td>
          </tr>
        `;
      })
      .join("");

    const tablaEmilse = movimientosTableHtml(summary.movsEmilse);
    const tablaDepto = movimientosTableHtml(summary.movsDepto);

    const content = `
      <h2 class="section-title">Aportes netos (USD)</h2>
      <div class="cards">
        ${cardsAportes}
      </div>

      <h2 class="section-title">Balance entre hermanos</h2>
      <div class="cards">
        ${cardsBalance}
      </div>

      <h3 class="section-title">Diferencias respecto al promedio de aportes netos</h3>
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

      <h3 class="section-title">Datos generales</h3>
      <div class="card">
        <p>Total gastos Emilse: <strong>${summary.totalGastosEmilse.toFixed(
          2
        )} USD</strong></p>
        <p>Parte justa por hermano: <strong>${summary.equalShare.toFixed(
          2
        )} USD</strong></p>
        <p>Promedio aportes netos: <strong>${summary.avgNet.toFixed(
          2
        )} USD</strong></p>
      </div>

      <h2 class="section-title">Movimientos - Emilse</h2>
      ${tablaEmilse}

      <h2 class="section-title">Movimientos - Depto Gerardo</h2>
      ${tablaDepto}
    `;

    res.send(renderPage({ title: "Panel hermanos", content, isAdmin: false }));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error interno");
  }
});

// Panel admin
app.get("/admin", (req, res) => {
  try {
    const summary = computeSummary();
    const contributors = summary.contributors;

    const optionsContributors = contributors
      .map((c) => `<option value="${c.id}">${c.name}</option>`)
      .join("");

    const cardsAportes = contributors
      .map((c) => {
        const net = summary.aportNet[c.id] || 0;
        return `
          <div class="card">
            <h3>${c.name}</h3>
            <div class="amount neutral">${net.toFixed(2)} USD</div>
            <p class="small">Aportes netos al pozo de Emilse.</p>
          </div>
        `;
      })
      .join("");

    const cardsBalance = summary.resumenHermanos
      .map((r) => {
        const saldo = r.saldoPozo;
        const cls = saldo > 0 ? "positive" : saldo < 0 ? "negative" : "neutral";
        const sign = saldo >= 0 ? "+" : "";
        return `
          <div class="card">
            <h3>${r.name}</h3>
            <div class="amount ${cls}">${sign}${saldo.toFixed(2)} USD</div>
            <p class="small">
              Aportes netos totales: ${r.aport.toFixed(2)} USD<br>
              Saldo luego de repartir gastos de Emilse.
            </p>
          </div>
        `;
      })
      .join("");

    const tablaEmilse = movimientosTableHtml(summary.movsEmilse, {
      isAdmin: true,
    });
    const tablaDepto = movimientosTableHtml(summary.movsDepto, {
      isAdmin: true,
    });

    const today = new Date().toISOString().slice(0, 10);

    const content = `
      <div class="flash">
        Este panel es solo para carga y borrado de movimientos.
        Compartí con la familia solo la URL del panel de hermanos.
      </div>

      <h2 class="section-title">Aportes netos (USD)</h2>
      <div class="cards">
        ${cardsAportes}
      </div>

      <h2 class="section-title">Balance entre hermanos</h2>
      <div class="cards">
        ${cardsBalance}
      </div>

      <h2 class="section-title">Cargar nuevo movimiento</h2>
      <form method="POST" action="/admin/movements" class="form-box">
        <div class="form-row">
          <div class="form-field">
            <label for="date">Fecha</label>
            <input type="date" id="date" name="date" value="${today}" required />
          </div>
          <div class="form-field">
            <label for="contributor_id">Quién pone / paga</label>
            <select id="contributor_id" name="contributor_id" required>
              ${optionsContributors}
            </select>
          </div>
          <div class="form-field">
            <label for="direction">Tipo</label>
            <select id="direction" name="direction" required>
              <option value="IN">Ingreso (aporta al pozo)</option>
              <option value="OUT">Egreso (se paga algo)</option>
            </select>
          </div>
          <div class="form-field">
            <label for="category">Categoría</label>
            <select id="category" name="category" required>
              <option value="EMILSE">Emilse (geriátrico y asociados)</option>
              <option value="DEPTO">Depto Gerardo</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="amount_local">Monto en moneda local</label>
            <input type="number" step="0.01" id="amount_local" name="amount_local" required />
          </div>
          <div class="form-field">
            <label for="currency">Moneda</label>
            <input type="text" id="currency" name="currency" value="ARS" required />
          </div>
          <div class="form-field">
            <label for="fx_to_usd">Tipo de cambio → USD</label>
            <input type="number" step="0.0001" id="fx_to_usd" name="fx_to_usd" required />
            <span class="small">
              Monto local dividido por este valor = USD.<br />
              Ej: si 1 USD = 1000 ARS, escribí 1000.
            </span>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="description">Descripción</label>
            <textarea id="description" name="description"
              placeholder="Ej: Gerardo envía euros, se convierten a pesos..."></textarea>
          </div>
        </div>

        <button type="submit">Guardar movimiento</button>
      </form>

      <h2 class="section-title">Movimientos - Emilse</h2>
      ${tablaEmilse}

      <h2 class="section-title">Movimientos - Depto Gerardo</h2>
      ${tablaDepto}

      <script>
        // Autocompletar tipo de cambio desde dolarapi.com, solo en el navegador
        (async function () {
          try {
            const currencyInput = document.getElementById('currency');
            const fxInput = document.getElementById('fx_to_usd');
            if (!currencyInput || !fxInput) return;

            const resp = await fetch('https://dolarapi.com/v1/dolares/oficial');
            if (!resp.ok) return;
            const data = await resp.json();
            if (data && typeof data.venta === 'number') {
              if (currencyInput.value.toUpperCase() === 'ARS') {
                fxInput.value = data.venta;
              }
              const hint = document.createElement('div');
              hint.className = 'small';
              hint.textContent = 'TC sugerido dólar oficial venta: $' + data.venta +
                                 ' ARS por USD (podés modificarlo).';
              fxInput.parentElement.appendChild(hint);
            }
          } catch (e) {
            console.error('No se pudo obtener TC automático', e);
          }
        })();
      </script>
    `;

    res.send(renderPage({ title: "Panel admin", content, isAdmin: true }));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error interno");
  }
});

// Crear movimiento
app.post("/admin/movements", (req, res) => {
  try {
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

    const amountLocalNum = parseFloat(amount_local);
    const fxNum = parseFloat(fx_to_usd);

    if (!amountLocalNum || !fxNum) {
      return res.status(400).send("Monto y tipo de cambio deben ser numéricos.");
    }

    const amountUsd = amountLocalNum / fxNum;

    db.prepare(
      `INSERT INTO movements
       (date, contributor_id, direction, category, description,
        amount_local, currency, fx_to_usd, amount_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      date,
      parseInt(contributor_id, 10),
      direction,
      category,
      description || "",
      amountLocalNum,
      currency.toUpperCase(),
      fxNum,
      amountUsd
    );

    res.redirect("/admin");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al guardar el movimiento.");
  }
});

// Borrar movimiento
app.post("/admin/movements/:id/delete", (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).send("ID inválido.");
    }
    db.prepare("DELETE FROM movements WHERE id = ?").run(id);
    res.redirect("/admin");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al borrar el movimiento.");
  }
});

// Arrancar servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
