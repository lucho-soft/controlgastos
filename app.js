const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));

// Carpeta para uploads temporales (restore)
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

            .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-top: 20px;
      margin-bottom: 24px;
    }

    .chart-card {
      background: white;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,.06);
      padding: 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .chart-card h3 {
      margin-top: 0;
      font-size: 1rem;
      margin-bottom: 8px;
    }

    .chart-wrapper {
      position: relative;
      width: 100%;
      height: 220px;
    }

    @media (min-width: 992px) {
      .chart-wrapper {
        height: 260px;
      }
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
    .chart-small {
  width: 260px;
  height: 260px;
  margin: 0 auto;
}
.chart-small canvas {
  width: 100% !important;
  height: 100% !important;
}

  </style>
`;

// ---- BASE DE DATOS ----
const dbFile = path.join(__dirname, "familia-emilse.db");
const db = new Database(dbFile);
db.pragma("journal_mode = WAL");

function initDb() {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS contributors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    )
  `
  ).run();

  db.prepare(
    `
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
      movement_kind TEXT NOT NULL DEFAULT 'NORMAL',
      bank TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contributor_id) REFERENCES contributors(id)
    )
  `
  ).run();

  // Por si la tabla ya existía antes de movement_kind / bank
  try {
    db.prepare(
      `ALTER TABLE movements ADD COLUMN movement_kind TEXT NOT NULL DEFAULT 'NORMAL'`
    ).run();
  } catch (e) {}
  try {
    db.prepare(`ALTER TABLE movements ADD COLUMN bank TEXT`).run();
  } catch (e) {}

  const ins = db.prepare(
    "INSERT OR IGNORE INTO contributors (name) VALUES (?)"
  );
  ["Gerardo", "Néstor", "Leandro", "Emilse"].forEach((n) => ins.run(n));
}
initDb();

function getContributors() {
  return db.prepare("SELECT * FROM contributors ORDER BY id").all();
}

function getMovements() {
  // Más reciente primero
  return db
    .prepare(
      `
    SELECT m.*, c.name AS contributor_name
    FROM movements m
    JOIN contributors c ON c.id = m.contributor_id
    ORDER BY date DESC, m.id DESC
  `
    )
    .all();
}

function computeSummary() {
  const contributors = getContributors();
  const movements = getMovements();

  const aporteUsd = {};
  const aportePesos = {};
  const balanceUsd = {};

  contributors.forEach((c) => {
    aporteUsd[c.id] = 0;
    aportePesos[c.id] = 0;
    balanceUsd[c.id] = 0;
  });

  const emilse = contributors.find((c) => c.name === "Emilse");
  const emilseId = emilse?.id ?? null;
  const gerardo = contributors.find((c) => c.name === "Gerardo");
  const gerardoId = gerardo?.id ?? null;
  const hermanos = contributors.filter((c) =>
    ["Gerardo", "Néstor", "Leandro"].includes(c.name)
  );

  const bankBalances = {
    GALICIA: 0,
    FRANCES: 0,
    EFECTIVO: 0,
  };

  let totalGastosEmilse = 0;

  // NUEVO: gastos del depto de Gerardo
  let totalGastosDeptoUsd = 0;
  let totalGastosDeptoArs = 0;

  // Uso del pozo para gastos de Emilse
  const usoEmilse = {
    fromEmilse: 0,
    fromBrothers: 0,
    fromEmilseArs: 0,
    fromBrothersArs: 0,
    perBrother: {},
  };

  const sortedMovs = [...movements].sort((a, b) => {
    if (a.date === b.date) return a.id - b.id;
    return a.date.localeCompare(b.date);
  });

  for (const m of sortedMovs) {
    const kind = m.movement_kind || "NORMAL";

    // Siempre actualizamos saldos por banco (incluye TRANSFER / ADJUST)
    if (m.bank) {
      const bankKey = m.bank.toUpperCase();
      if (!bankBalances[bankKey]) bankBalances[bankKey] = 0;
      const sign = m.direction === "IN" ? 1 : -1;
      bankBalances[bankKey] += sign * m.amount_local;
    }

    // Solo los movimientos NORMAL afectan el pozo entre personas
    if (kind !== "NORMAL") continue;

    const usd = m.amount_usd;
    const ars = m.amount_local;

    // 1) APORTES (IN): acá se construye el "total aportado histórico"
    if (m.direction === "IN") {
      aporteUsd[m.contributor_id] += usd;
      aportePesos[m.contributor_id] += ars;
      balanceUsd[m.contributor_id] += usd;
      continue;
    }

    // 2) GASTOS EMILSE
    if (m.direction === "OUT" && m.category === "EMILSE") {
      totalGastosEmilse += usd;

      let restanteUsd = usd;
      let restanteArs = ars;

      // Primero consume saldo de Emilse
      if (emilseId) {
        const disponibleEmilseUsd = Math.max(balanceUsd[emilseId], 0);
        const usaEmilseUsd = Math.min(disponibleEmilseUsd, restanteUsd);
        const proporEmilse = usd > 0 ? usaEmilseUsd / usd : 0;
        const usaEmilseArs = ars * proporEmilse;

        balanceUsd[emilseId] -= usaEmilseUsd;
        restanteUsd -= usaEmilseUsd;
        restanteArs -= usaEmilseArs;

        usoEmilse.fromEmilse += usaEmilseUsd;
        usoEmilse.fromEmilseArs += usaEmilseArs;
      }

      // Luego, lo que falta lo ponen los hermanos
      if (restanteUsd > 0 && hermanos.length > 0) {
        const parteUsd = restanteUsd / hermanos.length;
        const parteArs = restanteArs / hermanos.length;

        hermanos.forEach((h) => {
          balanceUsd[h.id] -= parteUsd;
          usoEmilse.fromBrothers += parteUsd;
          usoEmilse.fromBrothersArs += parteArs;
          usoEmilse.perBrother[h.id] =
            (usoEmilse.perBrother[h.id] || 0) + parteUsd;
        });
      }

      continue;
    }

    // 3) GASTOS DEPARTAMENTO GERARDO (SOLO LE PEGAN A ÉL)
    if (m.direction === "OUT" && m.category === "DEPTO" && gerardoId) {
      totalGastosDeptoUsd += usd;
      totalGastosDeptoArs += ars;

      // 🔹 SOLO afecta el saldo actual, no el total histórico aportado
      balanceUsd[gerardoId] -= usd;
      continue;
    }
  }

  const resumenHermanos = hermanos.map((h) => {
    const apUsd = aporteUsd[h.id] || 0;
    const apArs = aportePesos[h.id] || 0;
    const balUsd = balanceUsd[h.id] || 0;
    const rate = apUsd > 0 ? apArs / apUsd : 0;
    return {
      id: h.id,
      name: h.name,
      aport: apUsd,
      aportPesos: apArs,
      saldoPozo: balUsd,
      saldoPozoPesos: balUsd * rate,
    };
  });

  const emilseBalanceUsd = emilseId ? balanceUsd[emilseId] : 0;
  const hermanosBalanceUsd = hermanos.reduce(
    (acc, h) => acc + (balanceUsd[h.id] || 0),
    0
  );

  return {
    contributors,
    movements,
    aportNet: aporteUsd, // ahora es "total aportado histórico"
    aportePesos,
    resumenHermanos,
    balanceUsd,
    emilseBalanceUsd,
    hermanosBalanceUsd,
    totalPozoUsd: emilseBalanceUsd + hermanosBalanceUsd,
    totalGastosEmilse,
    totalGastosDeptoUsd,
    totalGastosDeptoArs,
    usoEmilse,
    movsEmilse: movements.filter((m) => m.category === "EMILSE"),
    movsDepto: movements.filter((m) => m.category === "DEPTO"),
    bankBalances,
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


  // Pozo según bancos: suma de Galicia + Francés + Efectivo
const totalPozoBancosArs = Object.values(s.bankBalances).reduce(
  (acc, val) => acc + (val || 0),
  0
);




  const gerardo = s.contributors.find((c) => c.name === "Gerardo");
  const nestor = s.contributors.find((c) => c.name === "Néstor");
  const leandro = s.contributors.find((c) => c.name === "Leandro");
  const emilse = s.contributors.find((c) => c.name === "Emilse");

  const gerardoId = gerardo?.id;
  const nestorId = nestor?.id;
  const leandroId = leandro?.id;
  const emilseId = emilse?.id;

  const aporteGerardoArs = gerardoId ? s.aportePesos[gerardoId] || 0 : 0;
  const aporteNestorArs = nestorId ? s.aportePesos[nestorId] || 0 : 0;
  const aporteLeandroArs = leandroId ? s.aportePesos[leandroId] || 0 : 0;
  const aporteEmilseArs = emilseId ? s.aportePesos[emilseId] || 0 : 0;

  const gastosDeptoArs = s.totalGastosDeptoArs || 0;
  const aporteGerardoNetoArs = aporteGerardoArs - gastosDeptoArs;

  // ---- Saldos por banco ----
  const bankCards = Object.entries(s.bankBalances)
    .map(([bank, bal]) => {
      const niceName =
        bank === "GALICIA"
          ? "Banco Galicia"
          : bank === "FRANCES"
          ? "Banco Francés"
          : "Efectivo";
      const cls = bal > 0 ? "positive" : bal < 0 ? "negative" : "neutral";
      return `
        <div class="card">
          <h3>${niceName}</h3>
          <div class="amount ${cls}">${bal.toFixed(2)} ARS</div>
          <p class="small">Incluye ingresos, egresos, transferencias y ajustes.</p>
        </div>`;
    })
    .join("");

  // ---- Tabla de movimientos recientes ----
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
            <th>Banco</th>
            <th>Monto local</th>
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

              const bankLabel = m.bank
                ? m.bank === "GALICIA"
                  ? "Galicia"
                  : m.bank === "FRANCES"
                  ? "Francés"
                  : "Efectivo"
                : "-";

              return `
              <tr>
                <td>${m.date}</td>
                <td>${m.contributor_name}</td>
                <td>${tipo}</td>
                <td>${cat}</td>
                <td>${bankLabel}</td>
                <td>${m.amount_local.toFixed(2)} ${m.currency}</td>
                <td>${m.amount_usd.toFixed(2)}</td>
                <td>${m.description || ""}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>`;

  const recientes = tablaMovimientos(s.movements);

  // ---- Datos para los 4 gráficos (todas barras en ARS) ----

  // 1) Arriba izquierda: barras con total aportado por cada uno (ARS)
  const aportesTotalesLabels = s.contributors.map((c) => c.name);
  const aportesTotalesDataArs = s.contributors.map((c) =>
    Math.max(s.aportePesos[c.id] || 0, 0)
  );

  // 2) Arriba derecha: barras - Aportes Gerardo vs Gastos Depto (ARS)
  const gerardoDeptoLabels = ["Aportes Gerardo", "Gastos Depto"];
  const gerardoDeptoData = [
    Math.max(aporteGerardoArs, 0),
    Math.max(gastosDeptoArs, 0),
  ];

  // 3) Abajo izquierda: barras - quién cubrió gastos de Emilse (ARS)
  const gastosEmilseLabels = ["Cubierto por Emilse", "Cubierto por hermanos"];
  const gastosEmilseData = [
    Math.max(s.usoEmilse.fromEmilseArs || 0, 0),
    Math.max(s.usoEmilse.fromBrothersArs || 0, 0),
  ];

  // 4) Abajo derecha: barras - aporte efectivo al fondo (hermanos, ARS)
  const aportesEfectivosLabels = ["Gerardo neto", "Néstor", "Leandro"];
  const aportesEfectivosData = [
    Math.max(aporteGerardoNetoArs, 0),
    Math.max(aporteNestorArs, 0),
    Math.max(aporteLeandroArs, 0),
  ];

  const content = `
    <h2 class="section-title">Resumen visual de aportes y gastos</h2>
    <div class="dashboard-grid">
      <div class="chart-card">
        <h3>Total aportado al pozo (histórico, ARS)</h3>
        <p class="small">Incluye aportes de Gerardo, Néstor, Leandro y Emilse.</p>
        <div class="chart-wrapper">
          <canvas id="aportesTotalesChart"></canvas>
        </div>
      </div>

      <div class="chart-card">
        <h3>Gerardo: aportes vs gastos de departamento (ARS)</h3>
        <p class="small">
          Aportes Gerardo: ${aporteGerardoArs.toFixed(2)} ARS<br/>
          Gastos Depto: ${gastosDeptoArs.toFixed(2)} ARS
        </p>
        <div class="chart-wrapper">
          <canvas id="gerardoDeptoChart"></canvas>
        </div>
      </div>

      <div class="chart-card">
        <h3>Quién cubrió los gastos de Emilse (ARS)</h3>
        <p class="small">
          Se muestra cuánto se cubrió con el propio pozo de Emilse y cuánto con el pozo de los hermanos.
        </p>
        <div class="chart-wrapper">
          <canvas id="gastosEmilseChart"></canvas>
        </div>
      </div>

      <div class="chart-card">
        <h3>Aporte efectivo al fondo común (hermanos, ARS)</h3>
        <p class="small">
          Gerardo neto = aportes - gastos de depto.
        </p>
        <div class="chart-wrapper">
          <canvas id="aportesEfectivosChart"></canvas>
        </div>
      </div>

</div>


    <h2 class="section-title">Pozo actual</h2>
<div class="cards">
  <div class="card">
    <h3>Saldo total en bancos</h3>
    <div class="amount neutral">${totalPozoBancosArs.toFixed(2)} ARS</div>
    <p class="small">
      Suma de saldos: Galicia + Francés + Efectivo.
    </p>
  </div>
</div>

    <h2 class="section-title">Saldos por banco</h2>
    <div class="cards">${bankCards}</div>

    <h2 class="section-title">Movimientos recientes</h2>
    ${recientes}

    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
      (function () {
        // Paleta básica
        var baseColors = [
          'rgba(33, 150, 243, 0.9)',
          'rgba(76, 175, 80, 0.9)',
          'rgba(255, 193, 7, 0.9)',
          'rgba(244, 67, 54, 0.9)'
        ];

        // 1) Barras total aportado
        var ctx1 = document.getElementById('aportesTotalesChart');
        var labels1 = ${JSON.stringify(aportesTotalesLabels)};
        var data1 = ${JSON.stringify(aportesTotalesDataArs)};
        if (ctx1 && data1.reduce((a, b) => a + b, 0) > 0) {
          new Chart(ctx1, {
            type: 'bar',
            data: {
              labels: labels1,
              datasets: [{
                data: data1,
                backgroundColor: labels1.map(function(_, i) {
                  return baseColors[i % baseColors.length];
                }),
                borderRadius: 8
              }]
            },
            options: {
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      var val = context.parsed.y || 0;
                      return val.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
                    }
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: function(value) {
                      return value.toLocaleString('es-AR');
                    }
                  }
                }
              }
            }
          });
        }

        // 2) Barras horizontales Gerardo vs Depto
        var ctx2 = document.getElementById('gerardoDeptoChart');
        var labels2 = ${JSON.stringify(gerardoDeptoLabels)};
        var data2 = ${JSON.stringify(gerardoDeptoData)};
        if (ctx2 && data2.reduce((a, b) => a + b, 0) > 0) {
          new Chart(ctx2, {
            type: 'bar',
            data: {
              labels: labels2,
              datasets: [{
                data: data2,
                backgroundColor: [
                  'rgba(33, 150, 243, 0.9)',
                  'rgba(244, 67, 54, 0.9)'
                ],
                borderRadius: 8
              }]
            },
            options: {
              indexAxis: 'y',
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      var val = context.parsed.x || 0;
                      return val.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
                    }
                  }
                }
              },
              scales: {
                x: {
                  beginAtZero: true,
                  ticks: {
                    callback: function(value) {
                      return value.toLocaleString('es-AR');
                    }
                  }
                }
              }
            }
          });
        }

        // 3) Barras horizontales gastos Emilse
        var ctx3 = document.getElementById('gastosEmilseChart');
        var labels3 = ${JSON.stringify(gastosEmilseLabels)};
        var data3 = ${JSON.stringify(gastosEmilseData)};
        if (ctx3 && data3.reduce((a, b) => a + b, 0) > 0) {
          new Chart(ctx3, {
            type: 'bar',
            data: {
              labels: labels3,
              datasets: [{
                data: data3,
                backgroundColor: [
                  'rgba(76, 175, 80, 0.9)',
                  'rgba(255, 193, 7, 0.9)'
                ],
                borderRadius: 8
              }]
            },
            options: {
              indexAxis: 'y',
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      var val = context.parsed.x || 0;
                      return val.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
                    }
                  }
                }
              },
              scales: {
                x: {
                  beginAtZero: true,
                  ticks: {
                    callback: function(value) {
                      return value.toLocaleString('es-AR');
                    }
                  }
                }
              }
            }
          });
        }

        // 4) Barras aporte efectivo hermanos
        var ctx4 = document.getElementById('aportesEfectivosChart');
        var labels4 = ${JSON.stringify(aportesEfectivosLabels)};
        var data4 = ${JSON.stringify(aportesEfectivosData)};
        if (ctx4 && data4.reduce((a, b) => a + b, 0) > 0) {
          new Chart(ctx4, {
            type: 'bar',
            data: {
              labels: labels4,
              datasets: [{
                data: data4,
                backgroundColor: [
                  'rgba(33, 150, 243, 0.9)',
                  'rgba(76, 175, 80, 0.9)',
                  'rgba(255, 193, 7, 0.9)'
                ],
                borderRadius: 8
              }]
            },
            options: {
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      var val = context.parsed.y || 0;
                      return val.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
                    }
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: function(value) {
                      return value.toLocaleString('es-AR');
                    }
                  }
                }
              }
            }
          });
        }
      })();
    </script>
  `;

  res.send(renderPage({ title: "Hermanos", content }));
});

// ---- PANEL ADMIN ----
app.get("/admin", (req, res) => {
  const s = computeSummary();
  const contributors = s.contributors;
  const today = new Date().toISOString().slice(0, 10);

  const emilse = contributors.find((c) => c.name === "Emilse");
  const otros = contributors.filter((c) => c.name !== "Emilse");

  let optionsContributors = "";
  if (emilse) {
    optionsContributors += `<option value="${emilse.id}" selected>Emilse</option>`;
  }
  optionsContributors += otros
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
            <th>Banco</th>
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

              const bankLabel = m.bank
                ? m.bank === "GALICIA"
                  ? "Galicia"
                  : m.bank === "FRANCES"
                  ? "Francés"
                  : "Efectivo"
                : "-";

              return `
              <tr>
                <td>${m.date}</td>
                <td>${m.contributor_name}</td>
                <td>${tipo}</td>
                <td>${cat}</td>
                <td>${bankLabel}</td>
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

  const bankCards = Object.entries(s.bankBalances)
    .map(([bank, bal]) => {
      const niceName =
        bank === "GALICIA"
          ? "Banco Galicia"
          : bank === "FRANCES"
          ? "Banco Francés"
          : "Efectivo";
      const cls = bal > 0 ? "positive" : bal < 0 ? "negative" : "neutral";
      return `
        <div class="card">
          <h3>${niceName}</h3>
          <div class="amount ${cls}">${bal.toFixed(2)} ARS</div>
          <p class="small">Saldo estimado con todos los movimientos, incluyendo transferencias y ajustes.</p>
        </div>`;
    })
    .join("");

  const content = `
    <div class="flash">
      Panel admin (acceso manual /admin). No compartas esta URL con los hermanos.
    </div>

    <h2 class="section-title">Saldos por banco</h2>
    <div class="cards">
      ${bankCards}
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
          Después de sobrescribir, conviene reiniciar el servicio.
        </p>
        <button type="submit" style="background:#6a1b9a;">🔁 Restaurar base</button>
      </form>
    </div>

    <h2 class="section-title">Nuevo movimiento</h2>
    <div class="card">
      <p class="small"><b>Normal</b>: uso real del pozo (aportes, gastos de Emilse, depto).</p>
      <p class="small"><b>Transfer</b>: mueve saldos entre Galicia / Francés / Efectivo sin cambiar el pozo.</p>
      <p class="small"><b>Ajuste</b>: corrige el saldo registrado de un banco específico.</p>
    </div>
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
          <label>Tipo (Ingreso / Egreso)</label>
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
          <label>Tipo de movimiento</label>
          <select name="movement_kind" id="movement_kind" required>
            <option value="NORMAL" selected>Normal (aportes o gastos reales)</option>
            <option value="TRANSFER">Mover dinero entre bancos (no afecta pozo)</option>
            <option value="ADJUST">Ajuste de saldo de un banco</option>
          </select>
        </div>
        <div class="form-field">
          <label>Banco (para NORMAL / AJUSTE)</label>
          <select name="bank">
            <option value="">-- Sin banco / efectivo --</option>
            <option value="GALICIA">Galicia</option>
            <option value="FRANCES">Francés</option>
            <option value="EFECTIVO">Efectivo</option>
          </select>
        </div>
        <div class="form-field">
          <label>Banco origen (para TRANSFER)</label>
          <select name="bank_from">
            <option value="">-- Seleccionar --</option>
            <option value="GALICIA">Galicia</option>
            <option value="FRANCES">Francés</option>
            <option value="EFECTIVO">Efectivo</option>
          </select>
        </div>
        <div class="form-field">
          <label>Banco destino (para TRANSFER)</label>
          <select name="bank_to">
            <option value="">-- Seleccionar --</option>
            <option value="GALICIA">Galicia</option>
            <option value="FRANCES">Francés</option>
            <option value="EFECTIVO">Efectivo</option>
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
      <textarea name="description" placeholder="Ej: Pago mes geriátrico, expensas depto, transferencia entre bancos, etc."></textarea>

      <button type="submit">Guardar movimiento</button>
    </form>

    <h2 class="section-title">Movimientos - Emilse</h2>
    ${tablaMovAdmin(s.movsEmilse)}

    <h2 class="section-title">Movimientos - Depto Gerardo</h2>
    ${tablaMovAdmin(s.movsDepto)}

    <script>
      (function () {
        var dateInput = document.querySelector('input[name="date"]');
        var currencyInput = document.querySelector('input[name="currency"]');
        var fxInput = document.querySelector('input[name="fx_to_usd"]');

        if (!dateInput || !currencyInput || !fxInput) return;

        async function cargarTCParaFecha(fechaISO) {
          try {
            if (!fechaISO) return;
            if (currencyInput.value.toUpperCase() !== 'ARS') return;

            var partes = fechaISO.split('-');
            if (partes.length !== 3) return;
            var fechaApi = partes[0] + '/' + partes[1] + '/' + partes[2];

            // 1) Intento TC histórico para la fecha exacta
            var urlFecha = 'https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial/' + fechaApi;
            var resp = await fetch(urlFecha);
            var q = null;

            if (resp.ok) {
              var data = await resp.json();
              q = Array.isArray(data) ? data[0] : data;
            }

            // 2) Si no hay dato para esa fecha, uso la ÚLTIMA cotización disponible
            if (!q || typeof q.venta !== 'number') {
              var resp2 = await fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial');
              if (resp2.ok) {
                var data2 = await resp2.json();
                var last = null;

                if (Array.isArray(data2) && data2.length > 0) {
                  last = data2[data2.length - 1]; // el último registro
                } else if (data2 && typeof data2 === 'object') {
                  last = data2;
                }

                if (last && typeof last.venta === 'number') {
                  fxInput.value = String(last.venta);
                  return;
                }
              }
              console.warn('No se pudo obtener TC ni histórico ni último disponible');
              return;
            }

            fxInput.value = String(q.venta);
          } catch (e) {
            console.error('Error obteniendo TC histórico', e);
          }
        }

        // Al cargar la página, usar la fecha actual del form
        if (dateInput.value) {
          cargarTCParaFecha(dateInput.value);
        }

        // Cada vez que cambie la fecha, volvemos a consultar
        dateInput.addEventListener('change', function () {
          if (this.value) {
            cargarTCParaFecha(this.value);
          }
        });
      })();
    </script>
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
    movement_kind,
    bank,
    bank_from,
    bank_to,
  } = req.body;

  const local = parseFloat(amount_local);
  const fx = parseFloat(fx_to_usd);
  if (!local || !fx) {
    return res.status(400).send("Monto y tipo de cambio deben ser numéricos.");
  }
  const usd = local / fx;
  const kind = movement_kind || "NORMAL";

  // Transferencia entre cuentas: dos movimientos (OUT + IN) con Emilse
  if (kind === "TRANSFER") {
    if (!bank_from || !bank_to || bank_from === bank_to) {
      return res
        .status(400)
        .send(
          "Para una transferencia indicá banco origen y destino distintos."
        );
    }

    const contributors = getContributors();
    const emilse = contributors.find((c) => c.name === "Emilse");
    if (!emilse) {
      return res
        .status(500)
        .send("No se encontró a Emilse como contribuyente.");
    }
    const emilseId = emilse.id;

    const baseDesc =
      (description || "").trim() ||
      "Transferencia entre cuentas " + bank_from + " → " + bank_to;

    // Salida del banco origen
    db.prepare(
      `INSERT INTO movements
       (date, contributor_id, direction, category, description,
        amount_local, currency, fx_to_usd, amount_usd, movement_kind, bank)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      date,
      emilseId,
      "OUT",
      "EMILSE",
      baseDesc + " (origen)",
      local,
      currency.toUpperCase(),
      fx,
      usd,
      "TRANSFER",
      bank_from
    );

    // Entrada al banco destino
    db.prepare(
      `INSERT INTO movements
       (date, contributor_id, direction, category, description,
        amount_local, currency, fx_to_usd, amount_usd, movement_kind, bank)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      date,
      emilseId,
      "IN",
      "EMILSE",
      baseDesc + " (destino)",
      local,
      currency.toUpperCase(),
      fx,
      usd,
      "TRANSFER",
      bank_to
    );

    return res.redirect("/admin");
  }

  // Movimiento normal o ajuste: un solo registro
  const usedBank = bank || "";

  db.prepare(
    `INSERT INTO movements
     (date, contributor_id, direction, category, description,
      amount_local, currency, fx_to_usd, amount_usd, movement_kind, bank)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    date,
    parseInt(contributor_id),
    direction,
    category,
    description || "",
    local,
    currency.toUpperCase(),
    fx,
    usd,
    kind,
    usedBank || null
  );

  res.redirect("/admin");
});

// ---- Borrar movimiento ----
app.post("/admin/movements/:id/delete", (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare("DELETE FROM movements WHERE id = ?").run(id);
  res.redirect("/admin");
});

// ---- Descargar base de datos ----
app.get("/admin/backup", (req, res) => {
  res.download(dbFile, "familia-emilse-backup.sqlite", (err) => {
    if (err) {
      console.error("Error enviando backup:", err);
      if (!res.headersSent) {
        res.status(500).send("No se pudo descargar la base de datos.");
      }
    }
  });
});

// ---- Restaurar base desde archivo ----
app.post("/admin/restore", upload.single("dbfile"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No se recibió archivo de base de datos.");
    }

    // Backup de la base actual antes de sobrescribir
    if (fs.existsSync(dbFile)) {
      const backupName = `familia-emilse-before-restore-${Date.now()}.sqlite`;
      const backupPath = path.join(__dirname, backupName);
      fs.copyFileSync(dbFile, backupPath);
      console.log("Backup previo creado:", backupPath);
    }

    // Copiar la base subida sobre la actual
    fs.copyFileSync(req.file.path, dbFile);

    // Borrar archivo temporal
    fs.unlink(req.file.path, () => {});

    const content = `
      <div class="flash">
        La base de datos fue restaurada desde el archivo subido.<br/>
        Se creó un backup previo en el servidor.<br/>
        Para que la aplicación use completamente la nueva base,
        conviene reiniciar el servicio (o volver a iniciar node).
      </div>
      <p><a href="/admin">Volver al panel admin</a></p>
    `;
    res.send(renderPage({ title: "Restaurar base", content }));
  } catch (err) {
    console.error("Error restaurando base:", err);
    res.status(500).send("Error al restaurar la base de datos.");
  }
});

// ---- Start ----
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
