const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para leer formularios
app.use(express.urlencoded({ extended: true }));

// CSS simple embebido
const baseStyles = `
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
      padding: 0;
      background: #f4f6f9;
      color: #222;
    }
    header {
      background: #1e88e5;
      color: white;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    header h1 {
      margin: 0;
      font-size: 1.4rem;
    }
    header nav a {
      color: #e3f2fd;
      text-decoration: none;
      margin-left: 16px;
      font-size: 0.9rem;
    }
    header nav a:hover {
      text-decoration: underline;
    }
    main {
      padding: 24px;
      max-width: 1100px;
      margin: 0 auto;
    }
    h2 {
      margin-top: 32px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 4px;
      font-size: 1.2rem;
    }
    .cards {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }
    .card {
      flex: 1 1 200px;
      background: white;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.06);
    }
    .card h3 {
      margin-top: 0;
      margin-bottom: 8px;
      font-size: 1rem;
      color: #444;
    }
    .card .amount {
      font-size: 1.4rem;
      font-weight: bold;
    }
    .card .positive { color: #2e7d32; }
    .card .negative { color: #c62828; }
    .card .neutral  { color: #616161; }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      font-size: 0.9rem;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 6px rgba(0,0,0,0.04);
    }
    th, td {
      padding: 8px 10px;
      border-bottom: 1px solid #eee;
      text-align: left;
    }
    th {
      background: #e3f2fd;
      font-weight: 600;
      font-size: 0.9rem;
    }
    tr:nth-child(even) td {
      background: #fafafa;
    }
    .tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .tag-emilse {
      background: #e8f5e9;
      color: #2e7d32;
    }
    .tag-depto {
      background: #fff3e0;
      color: #ef6c00;
    }
    .tag-in {
      background: #e3f2fd;
      color: #1565c0;
    }
    .tag-out {
      background: #ffebee;
      color: #c62828;
    }
    form {
      background: white;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.06);
      margin-top: 16px;
      font-size: 0.9rem;
    }
    .form-row {
      display: flex;
      gap: 16px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }
    .form-field {
      flex: 1 1 150px;
      display: flex;
      flex-direction: column;
    }
    label {
      font-size: 0.8rem;
      margin-bottom: 2px;
      color: #555;
    }
    input[type="text"],
    input[type="number"],
    input[type="date"],
    select {
      padding: 6px 8px;
      border-radius: 4px;
      border: 1px solid #ccc;
      font-size: 0.9rem;
    }
    textarea {
      padding: 6px 8px;
      border-radius: 4px;
      border: 1px solid #ccc;
      font-size: 0.9rem;
      resize: vertical;
      min-height: 40px;
    }
    button {
      background: #1e88e5;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 0.9rem;
      cursor: pointer;
      margin-top: 8px;
    }
    button:hover {
      background: #1565c0;
    }
    .small {
      font-size: 0.8rem;
      color: #666;
    }
    .flash {
      background: #e8f5e9;
      border: 1px solid #c8e6c9;
      color: #2e7d32;
      padding: 8px 12px;
      margin-bottom: 12px;
      border-radius: 4px;
      font-size: 0.85rem;
    }

    /* "Gráfico" de barras horizontales */
    .balance-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      font-size: 0.85rem;
    }
    .balance-table th,
    .balance-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #eee;
      text-align: left;
    }
    .balance-table th {
      background: #e3f2fd;
      font-weight: 600;
    }
    .bar-chart-container {
      margin-top: 16px;
      background: white;
      border-radius: 8px;
      padding: 12px 16px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.06);
    }
    .bar-chart-title {
      font-size: 0.9rem;
      color: #444;
      margin: 0 0 8px 0;
    }
    .bar-h-container {
      width: 100%;
      max-width: 260px;
      height: 10px;
      background: #eeeeee;
      border-radius: 999px;
      overflow: hidden;
      position: relative;
    }
    .bar-h {
      height: 100%;
      border-radius: 999px;
    }
    .bar-positive-h {
      background: #2e7d32;
    }
    .bar-negative-h {
      background: #c62828;
    }
    .bar-zero-h {
      background: #bdbdbd;
    }
  </style>
`;

// Base de datos SQLite
const dbFile = path.join(__dirname, "familia-emilse.db");
const db = new sqlite3.Database(dbFile);

// Inicializar schema y datos básicos
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS contributors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );
  `);

  db.run(`
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
    );
  `);

  // Crear los 3 hermanos + Emilse si no existen
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO contributors (name) VALUES (?)
  `);
  ["Gerardo", "Néstor", "Leandro", "Emilse"].forEach((name) => stmt.run(name));
  stmt.finalize();
});

// Helpers de DB
function getContributors() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM contributors ORDER BY id`, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function getMovements() {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT m.*, c.name as contributor_name
      FROM movements m
      JOIN contributors c ON c.id = m.contributor_id
      ORDER BY date ASC, m.id ASC
      `,
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

// Render genérico
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
      <header>
        <h1>Cuenta familiar - Emilse</h1>
        <nav>
          <a href="/">Panel hermanos (lectura)</a>
        </nav>
      </header>
      <main>
        ${content}
      </main>
    </body>
    </html>
  `;
}

// Cálculos de balances resumen
async function computeSummary() {
  const contributors = await getContributors();
  const movements = await getMovements();

  // Aportes al pozo en USD (ingresos)
  const contribsEmilse = {};
  contributors.forEach((c) => {
    contribsEmilse[c.id] = 0;
  });

  let totalGastosEmilse = 0;
  let ajusteGerardoDepto = 0;

  const gerardo = contributors.find((c) =>
    c.name.toLowerCase().startsWith("gerardo")
  );
  const gerardoId = gerardo ? gerardo.id : null;

  for (const m of movements) {
    if (m.direction === "IN") {
      // Todo ingreso va a la bolsa de Emilse
      contribsEmilse[m.contributor_id] += m.amount_usd;
    } else if (m.direction === "OUT") {
      if (m.category === "EMILSE") {
        totalGastosEmilse += m.amount_usd;
      } else if (m.category === "DEPTO" && gerardoId) {
        // Se paga depto con la bolsa → baja Gerardo
        ajusteGerardoDepto -= m.amount_usd;
      }
    }
  }

  // Aportes netos (ya descontado depto de Gerardo)
  const aportesNetPorPersona = {};
  contributors.forEach((c) => {
    let neto = contribsEmilse[c.id] || 0;
    if (gerardoId && c.id === gerardoId) {
      neto += ajusteGerardoDepto;
    }
    aportesNetPorPersona[c.id] = neto;
  });

  // Solo hermanos para los balances entre ellos
  const hermanos = contributors.filter((c) =>
    ["Gerardo", "Néstor", "Leandro"].includes(c.name)
  );
  const cantHermanos = hermanos.length || 1;

  // Parte justa de gastos de Emilse
  const equalShareHermanos = totalGastosEmilse / cantHermanos;

  // Promedio de aportes netos entre hermanos
  let totalNetHermanos = 0;
  hermanos.forEach((c) => {
    totalNetHermanos += aportesNetPorPersona[c.id] || 0;
  });
  const avgNetHermanos = totalNetHermanos / cantHermanos;

  const resumenHermanos = hermanos.map((c) => {
    const aportes = aportesNetPorPersona[c.id] || 0;
    const saldoPozo = aportes - equalShareHermanos;
    const diffEquidad = aportes - avgNetHermanos;

    return {
      id: c.id,
      name: c.name,
      aportes,
      saldoPozo,
      diffEquidad,
    };
  });

  const movsEmilse = movements.filter((m) => m.category === "EMILSE");
  const movsDepto = movements.filter((m) => m.category === "DEPTO");

  return {
    contributors,
    aportesNetPorPersona,
    hermanos,
    resumenHermanos,
    totalGastosEmilse,
    equalShareHermanos,
    avgNetHermanos,
    movsEmilse,
    movsDepto,
  };
}

// "Gráfico" de barras horizontales (balance vs promedio)
function buildBalanceChartHtml(summary) {
  let maxAbsDiff = 0;
  summary.resumenHermanos.forEach((p) => {
    const abs = Math.abs(p.diffEquidad);
    if (abs > maxAbsDiff) maxAbsDiff = abs;
  });
  if (maxAbsDiff === 0) maxAbsDiff = 1;

  const rowsHtml = summary.resumenHermanos
    .map((p) => {
      const abs = Math.abs(p.diffEquidad);
      const widthPct = Math.max(5, Math.round((abs / maxAbsDiff) * 100));

      let barClass = "bar-zero-h";
      let desc = "En línea con el promedio";
      if (p.diffEquidad > 1e-6) {
        barClass = "bar-positive-h";
        desc = "Puso de más (podría recibir)";
      } else if (p.diffEquidad < -1e-6) {
        barClass = "bar-negative-h";
        desc = "Puso de menos (podría poner)";
      }
      const sign = p.diffEquidad >= 0 ? "+" : "";

      return `
        <tr>
          <td>${p.name}</td>
          <td>${sign}${p.diffEquidad.toFixed(2)} USD</td>
          <td>
            <div class="bar-h-container">
              <div class="bar-h ${barClass}" style="width:${widthPct}%;"></div>
            </div>
          </td>
          <td>${desc}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="bar-chart-container">
      <p class="bar-chart-title">
        Diferencia de aportes entre hermanos (en USD) respecto al promedio de aportes netos.
      </p>
      <table class="balance-table">
        <thead>
          <tr>
            <th>Hermano</th>
            <th>Diferencia</th>
            <th>Gráfico</th>
            <th>Comentario</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

// Tabla de movimientos
function movimientosTableHtml(movs, options = {}) {
  const { isAdmin = false } = options;

  if (!movs || movs.length === 0) {
    return `<p class="small">No hay movimientos registrados todavía.</p>`;
  }

  const rows = movs
    .map((m) => {
      const tagCat =
        m.category === "EMILSE"
          ? '<span class="tag tag-emilse">Emilse</span>'
          : '<span class="tag tag-depto">Depto</span>';
      const tagDir =
        m.direction === "IN"
          ? '<span class="tag tag-in">Ingreso</span>'
          : '<span class="tag tag-out">Egreso</span>';

      const acciones = isAdmin
        ? `
          <td>
            <form method="POST" action="/admin/movements/${m.id}/delete"
                  onsubmit="return confirm('¿Seguro que querés borrar este movimiento?');">
              <button type="submit" style="background:#c62828; margin:0; padding:4px 8px; font-size:0.8rem;">
                Eliminar
              </button>
            </form>
          </td>
        `
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
          <td>${m.description ? m.description : ""}</td>
          ${acciones}
        </tr>
      `;
    })
    .join("");

  const thAcciones = isAdmin ? "<th>Acciones</th>" : "";

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
          ${thAcciones}
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

// -------------------- Rutas --------------------

// Panel hermanos (solo lectura)
app.get("/", async (req, res) => {
  try {
    const summary = await computeSummary();

    // Aportes netos (incluye Emilse)
    const cardsAportes = summary.contributors
      .map((c) => {
        const neto = summary.aportesNetPorPersona[c.id] || 0;
        return `
          <div class="card">
            <h3>${c.name}</h3>
            <div class="amount neutral">
              ${neto.toFixed(2)} USD
            </div>
            <div class="small">
              Aportes netos al pozo de Emilse (ingresos menos ajustes por depto, si corresponde).
            </div>
          </div>
        `;
      })
      .join("");

    // Balance por hermano (saldo en bolsa + diferencia vs promedio)
    const cardsBalanceHermanos = summary.resumenHermanos
      .map((p) => {
        let clsSaldo = "neutral";
        if (p.saldoPozo > 1e-6) clsSaldo = "positive";
        else if (p.saldoPozo < -1e-6) clsSaldo = "negative";

        let clsDiff = "neutral";
        if (p.diffEquidad > 1e-6) clsDiff = "positive";
        else if (p.diffEquidad < -1e-6) clsDiff = "negative";

        const signSaldo = p.saldoPozo >= 0 ? "+" : "";
        const signDiff = p.diffEquidad >= 0 ? "+" : "";

        return `
          <div class="card">
            <h3>${p.name}</h3>
            <div class="amount ${clsSaldo}">
              ${signSaldo}${p.saldoPozo.toFixed(2)} USD
            </div>
            <div class="small">
              Saldo en la bolsa (aportes netos - gastos Emilse): ${signSaldo}${p.saldoPozo.toFixed(2)} USD<br/>
              Aportes netos totales: ${p.aportes.toFixed(2)} USD<br/>
              Diferencia vs promedio de aportes netos entre hermanos: 
              <span class="${clsDiff}">${signDiff}${p.diffEquidad.toFixed(2)} USD</span>
            </div>
          </div>
        `;
      })
      .join("");

    const balanceChartHtml = buildBalanceChartHtml(summary);

    const tablaEmilse = movimientosTableHtml(summary.movsEmilse);
    const tablaDepto = movimientosTableHtml(summary.movsDepto);

    const content = `
      <h2>Aportes netos al pozo (en USD)</h2>
      <div class="cards">
        ${cardsAportes}
      </div>

      <h2>Balance entre hermanos (en USD)</h2>
      <div class="cards">
        ${cardsBalanceHermanos}
      </div>
      ${balanceChartHtml}
      <div class="small">
        Total gastos Emilse: <strong>${summary.totalGastosEmilse.toFixed(2)} USD</strong> &mdash;
        Parte justa por hermano (solo Gerardo, Néstor y Leandro): 
        <strong>${summary.equalShareHermanos.toFixed(2)} USD</strong><br/>
        Promedio de aportes netos entre hermanos: <strong>${summary.avgNetHermanos.toFixed(2)} USD</strong>
      </div>

      <h2>Movimientos - Emilse</h2>
      ${tablaEmilse}

      <h2>Movimientos - Depto Gerardo</h2>
      ${tablaDepto}
    `;

    res.send(renderPage({ title: "Panel hermanos", content, isAdmin: false }));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error interno");
  }
});

// Panel admin
app.get("/admin", async (req, res) => {
  try {
    const summary = await computeSummary();
    const contributors = summary.contributors;

    const cardsAportes = contributors
      .map((c) => {
        const neto = summary.aportesNetPorPersona[c.id] || 0;
        return `
          <div class="card">
            <h3>${c.name}</h3>
            <div class="amount neutral">
              ${neto.toFixed(2)} USD
            </div>
            <div class="small">
              Aportes netos al pozo de Emilse.
            </div>
          </div>
        `;
      })
      .join("");

    const cardsBalanceHermanos = summary.resumenHermanos
      .map((p) => {
        let clsSaldo = "neutral";
        if (p.saldoPozo > 1e-6) clsSaldo = "positive";
        else if (p.saldoPozo < -1e-6) clsSaldo = "negative";

        let clsDiff = "neutral";
        if (p.diffEquidad > 1e-6) clsDiff = "positive";
        else if (p.diffEquidad < -1e-6) clsDiff = "negative";

        const signSaldo = p.saldoPozo >= 0 ? "+" : "";
        const signDiff = p.diffEquidad >= 0 ? "+" : "";

        return `
          <div class="card">
            <h3>${p.name}</h3>
            <div class="amount ${clsSaldo}">
              ${signSaldo}${p.saldoPozo.toFixed(2)} USD
            </div>
            <div class="small">
              Saldo en la bolsa (aportes netos - gastos Emilse): ${signSaldo}${p.saldoPozo.toFixed(2)} USD<br/>
              Aportes netos totales: ${p.aportes.toFixed(2)} USD<br/>
              Diferencia vs promedio de aportes netos entre hermanos: 
              <span class="${clsDiff}">${signDiff}${p.diffEquidad.toFixed(2)} USD</span>
            </div>
          </div>
        `;
      })
      .join("");

    const balanceChartHtml = buildBalanceChartHtml(summary);

    const optionsContributors = contributors
      .map((c) => `<option value="${c.id}">${c.name}</option>`)
      .join("");

    const tablaEmilse = movimientosTableHtml(summary.movsEmilse, { isAdmin: true });
    const tablaDepto = movimientosTableHtml(summary.movsDepto, { isAdmin: true });

    const today = new Date().toISOString().slice(0, 10);

    const content = `
      <div class="flash">
        Este panel es solo para carga y borrado de movimientos. Compartí con los hermanos únicamente la URL del panel de lectura.
      </div>

      <h2>Aportes netos al pozo (en USD)</h2>
      <div class="cards">
        ${cardsAportes}
      </div>

      <h2>Balance entre hermanos (en USD)</h2>
      <div class="cards">
        ${cardsBalanceHermanos}
      </div>
      ${balanceChartHtml}
      <div class="small">
        Total gastos Emilse: <strong>${summary.totalGastosEmilse.toFixed(2)} USD</strong> &mdash;
        Parte justa por hermano (solo Gerardo, Néstor y Leandro): 
        <strong>${summary.equalShareHermanos.toFixed(2)} USD</strong><br/>
        Promedio de aportes netos entre hermanos: <strong>${summary.avgNetHermanos.toFixed(2)} USD</strong>
      </div>

      <h2>Cargar nuevo movimiento</h2>
      <form method="POST" action="/admin/movements">
        <div class="form-row">
          <div class="form-field">
            <label for="date">Fecha</label>
            <input type="date" id="date" name="date" value="${today}" required>
          </div>
          <div class="form-field">
            <label for="contributor_id">Quién pone / paga</label>
            <select name="contributor_id" id="contributor_id" required>
              ${optionsContributors}
            </select>
          </div>
          <div class="form-field">
            <label for="direction">Tipo de movimiento</label>
            <select name="direction" id="direction" required>
              <option value="IN">Ingreso (aporta plata al pozo)</option>
              <option value="OUT">Egreso (se paga algo)</option>
            </select>
          </div>
          <div class="form-field">
            <label for="category">Categoría</label>
            <select name="category" id="category" required>
              <option value="EMILSE">Emilse (geriátrico y gastos asociados)</option>
              <option value="DEPTO">Depto Gerardo</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="amount_local">Monto en moneda local</label>
            <input type="number" step="0.01" name="amount_local" id="amount_local" required>
          </div>
          <div class="form-field">
            <label for="currency">Moneda (ej: ARS, EUR, USD)</label>
            <input type="text" name="currency" id="currency" value="ARS" required>
          </div>
          <div class="form-field">
            <label for="fx_to_usd">Tipo de cambio → USD</label>
            <input type="number" step="0.0001" name="fx_to_usd" id="fx_to_usd" required>
            <span class="small">
              Monto local dividido por este valor = USD.<br>
              Ejemplo: si son ARS y 1 USD = 1000 ARS, escribí <strong>1000</strong>.
            </span>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="description">Descripción / detalle</label>
            <textarea name="description" id="description" placeholder="Ej: Gerardo envía euros, se convierten a pesos y se destinan 70% Emilse, 30% depto"></textarea>
          </div>
        </div>

        <button type="submit">Guardar movimiento</button>
      </form>

      <h2>Movimientos - Emilse</h2>
      ${tablaEmilse}

      <h2>Movimientos - Depto Gerardo</h2>
      ${tablaDepto}

      <script>
        // Autocompletar tipo de cambio con dólar oficial venta (DolarApi)
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
              hint.textContent =
                'TC sugerido (dólar oficial venta): $' + data.venta +
                ' ARS por USD – podés modificarlo si usaste otro valor o moneda.';
              fxInput.parentElement.appendChild(hint);
            }
          } catch (e) {
            console.error('No se pudo obtener el tipo de cambio automático', e);
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

  const sql = `
    INSERT INTO movements
    (date, contributor_id, direction, category, description, amount_local, currency, fx_to_usd, amount_usd)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [
      date,
      parseInt(contributor_id, 10),
      direction,
      category,
      description || "",
      amountLocalNum,
      currency.toUpperCase(),
      fxNum,
      amountUsd,
    ],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Error al guardar el movimiento.");
      }
      res.redirect("/admin");
    }
  );
});

// Borrar movimiento
app.post("/admin/movements/:id/delete", (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (!id) {
    return res.status(400).send("ID de movimiento inválido.");
  }

  db.run("DELETE FROM movements WHERE id = ?", [id], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error al borrar el movimiento.");
    }
    res.redirect("/admin");
  });
});

// Arrancar servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
