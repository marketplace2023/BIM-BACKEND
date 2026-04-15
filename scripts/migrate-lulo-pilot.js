require('dotenv').config();

/* eslint-disable no-console */
const { execFileSync } = require('child_process');
const path = require('path');
const mysql = require('mysql2/promise');

// ── Configuration ──────────────────────────────────────────
const MDB_PATH = path.resolve(__dirname, '../src/db/LULO.MDB');
const ACCESS_QUERY_SCRIPT = path.resolve(__dirname, 'access-query.ps1');
const PS32 = path.join(
  process.env.WINDIR || 'C:/Windows',
  'SysWOW64',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe',
);

const TENANT_ID = Number(process.env.MIGRATION_TENANT_ID || 1);
const BATCH_SIZE = 500;
const VIGENCIA = new Date().toISOString().slice(0, 10);

// ── Helpers ────────────────────────────────────────────────

function runAccessQuery(query) {
  const output = execFileSync(
    PS32,
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      ACCESS_QUERY_SCRIPT,
      '-DatabasePath',
      MDB_PATH,
      '-Query',
      query,
    ],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 * 30 },
  ).trim();

  if (!output) return [];
  const parsed = JSON.parse(output);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function toNumber(value, fallback = 0) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const normalized = String(value).replace(',', '.').trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value, fallback = '') {
  if (value == null) return fallback;
  return String(value).trim();
}

function categoriaFromCodigo(codigo) {
  const match = text(codigo).match(/^[A-Za-z]+/);
  return match ? match[0].toUpperCase() : null;
}

function normalizeRendimiento(value) {
  const numeric = Math.max(toNumber(value, 1), 0.0001);
  return Math.min(numeric, 9999.9999).toFixed(4);
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function batchInsert(db, tableName, columns, rows) {
  if (!rows.length) return { inserted: 0 };
  const placeholderRow = `(${columns.map(() => '?').join(', ')})`;
  let inserted = 0;
  let batchNum = 0;
  for (const batch of chunk(rows, BATCH_SIZE)) {
    batchNum++;
    const placeholders = batch.map(() => placeholderRow).join(', ');
    const values = batch.flat();
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders}`;
    const [result] = await db.query(sql, values);
    inserted += result.affectedRows;
    if (batchNum % 10 === 0) {
      console.log(`    ... batch ${batchNum} (${inserted} rows so far)`);
    }
  }
  return { inserted };
}

function elapsed(start) {
  return ((Date.now() - start) / 1000).toFixed(1) + 's';
}

// ── Tenant resolution ──────────────────────────────────────

async function resolveTenantId(db) {
  if (Number.isFinite(TENANT_ID) && TENANT_ID > 0) {
    const [rows] = await db.query('SELECT id, slug, name FROM tenants WHERE id = ?', [TENANT_ID]);
    if (rows.length) {
      console.log(`  Tenant found: id=${rows[0].id} slug=${rows[0].slug}`);
      return Number(rows[0].id);
    }
  }

  const [masterRows] = await db.query(
    "SELECT id, slug, name FROM tenants WHERE slug = 'marketplace-master' LIMIT 1",
  );
  if (masterRows.length) {
    console.log(`  Using marketplace-master: id=${masterRows[0].id}`);
    return Number(masterRows[0].id);
  }

  const [result] = await db.query(
    "INSERT INTO tenants (name, slug, status, created_at, updated_at) VALUES ('Marketplace Master', 'marketplace-master', 'active', NOW(), NOW())",
  );
  console.log(`  Created marketplace-master tenant: id=${result.insertId}`);
  return Number(result.insertId);
}

// ── Phase 1: Resources ─────────────────────────────────────

async function importResources(db, tenantId) {
  console.log('\n=== PHASE 1: Resources (bim_recursos) ===');
  const t0 = Date.now();

  console.log('  Reading ObraEqui...');
  const rawEqui = runAccessQuery(
    'SELECT CodEqu, Descri, CosEqu, CosDia, Deprec FROM ObraEqui',
  );
  console.log(`    ${rawEqui.length} equipos`);

  console.log('  Reading ObraMate...');
  const rawMate = runAccessQuery(
    'SELECT CodMat, Descri, CosMat, UniMat, Desper FROM ObraMate',
  );
  console.log(`    ${rawMate.length} materiales`);

  console.log('  Reading ObraMano...');
  const rawMano = runAccessQuery(
    'SELECT CodMan, Descri, Salari FROM ObraMano',
  );
  console.log(`    ${rawMano.length} mano de obra`);

  const totalAccess = rawEqui.length + rawMate.length + rawMano.length;
  console.log(`  Total from Access: ${totalAccess}`);

  const allResources = [
    ...rawEqui.map((r) => ({
      codigo: text(r.CodEqu),
      descripcion: text(r.Descri).substring(0, 300),
      unidad: 'dia',
      tipo: 'equipo',
      precio: toNumber(r.CosEqu).toFixed(4),
    })),
    ...rawMate.map((r) => ({
      codigo: text(r.CodMat),
      descripcion: text(r.Descri).substring(0, 300),
      unidad: text(r.UniMat).substring(0, 20) || 'und',
      tipo: 'material',
      precio: toNumber(r.CosMat).toFixed(4),
    })),
    ...rawMano.map((r) => ({
      codigo: text(r.CodMan),
      descripcion: text(r.Descri).substring(0, 300),
      unidad: 'jor',
      tipo: 'mano_obra',
      precio: toNumber(r.Salari).toFixed(4),
    })),
  ];

  // Load existing codigos for idempotency
  const [existingRows] = await db.query(
    'SELECT id, codigo FROM bim_recursos WHERE tenant_id = ?',
    [tenantId],
  );
  const existingSet = new Set(existingRows.map((r) => r.codigo));

  const newResources = allResources.filter((r) => r.codigo && !existingSet.has(r.codigo));
  const skipped = allResources.length - newResources.length;
  console.log(`  Existing (skip): ${skipped} | New to insert: ${newResources.length}`);

  if (newResources.length) {
    const columns = [
      'tenant_id', 'codigo', 'descripcion', 'unidad', 'tipo', 'precio',
      'vigencia', 'activo', 'created_at', 'updated_at',
    ];
    const rows = newResources.map((r) => [
      tenantId, r.codigo, r.descripcion, r.unidad, r.tipo, r.precio,
      VIGENCIA, 1, new Date(), new Date(),
    ]);
    const result = await batchInsert(db, 'bim_recursos', columns, rows);
    console.log(`  Inserted: ${result.inserted}`);
  }

  // Build full resourceMap (codigo → id) and resourcePriceMap (codigo → precio) after insert
  const [allRows] = await db.query(
    'SELECT id, codigo, precio FROM bim_recursos WHERE tenant_id = ?',
    [tenantId],
  );
  const resourceMap = new Map();
  const resourcePriceMap = new Map();
  for (const row of allRows) {
    resourceMap.set(row.codigo, Number(row.id));
    resourcePriceMap.set(row.codigo, Number(row.precio));
  }

  console.log(`  Resource map: ${resourceMap.size} entries | done in ${elapsed(t0)}`);
  return { resourceMap, resourcePriceMap, totalAccess, inserted: newResources.length, skipped };
}

// ── Phase 2: APUs ──────────────────────────────────────────

async function importApus(db, tenantId) {
  console.log('\n=== PHASE 2: APUs (bim_precios_unitarios) ===');
  const t0 = Date.now();

  console.log('  Reading ObraPart...');
  const rawApus = runAccessQuery(
    'SELECT CodPar, Descri, UniPar, RenPar, PreUni FROM ObraPart',
  );
  console.log(`  Total from Access: ${rawApus.length}`);

  const [existingRows] = await db.query(
    'SELECT id, codigo FROM bim_precios_unitarios WHERE tenant_id = ?',
    [tenantId],
  );
  const existingSet = new Set(existingRows.map((r) => r.codigo));

  const newApus = rawApus.filter((r) => {
    const codigo = text(r.CodPar);
    return codigo && !existingSet.has(codigo);
  });
  const skipped = rawApus.length - newApus.length;
  console.log(`  Existing (skip): ${skipped} | New to insert: ${newApus.length}`);

  if (newApus.length) {
    const columns = [
      'tenant_id', 'codigo', 'descripcion', 'unidad', 'categoria',
      'precio_base', 'rendimiento', 'vigencia', 'activo', 'created_at', 'updated_at',
    ];
    const rows = newApus.map((r) => {
      const codigo = text(r.CodPar);
      return [
        tenantId,
        codigo,
        text(r.Descri),
        text(r.UniPar).substring(0, 20) || 'und',
        categoriaFromCodigo(codigo),
        toNumber(r.PreUni).toFixed(4),
        normalizeRendimiento(r.RenPar),
        VIGENCIA,
        1,
        new Date(),
        new Date(),
      ];
    });
    const result = await batchInsert(db, 'bim_precios_unitarios', columns, rows);
    console.log(`  Inserted: ${result.inserted}`);
  }

  // Build full apuIdMap after insert
  const [allRows] = await db.query(
    'SELECT id, codigo FROM bim_precios_unitarios WHERE tenant_id = ?',
    [tenantId],
  );
  const apuIdMap = new Map();
  for (const row of allRows) apuIdMap.set(row.codigo, Number(row.id));

  console.log(`  APU map: ${apuIdMap.size} entries | done in ${elapsed(t0)}`);
  return { apuIdMap, totalAccess: rawApus.length, inserted: newApus.length, skipped };
}

// ── Phase 3: Decomposition ─────────────────────────────────

async function importDecomposition(db, apuIdMap, resourceMap, resourcePriceMap) {
  console.log('\n=== PHASE 3: Decomposition (bim_apu_descomposicion) ===');
  const t0 = Date.now();

  console.log('  Reading ObraPainMate...');
  const rawMate = runAccessQuery(
    'SELECT CodPar, CodIns, CanIns, Desper FROM ObraPainMate',
  );
  console.log(`    ${rawMate.length} material rows`);

  console.log('  Reading ObraPainMano...');
  const rawMano = runAccessQuery(
    'SELECT CodPar, CodIns, CanIns FROM ObraPainMano',
  );
  console.log(`    ${rawMano.length} mano de obra rows`);

  console.log('  Reading ObraPainEqui...');
  const rawEqui = runAccessQuery(
    'SELECT CodPar, CodIns, CanIns, Deprec FROM ObraPainEqui',
  );
  console.log(`    ${rawEqui.length} equipo rows`);

  const totalAccess = rawMate.length + rawMano.length + rawEqui.length;
  console.log(`  Total from Access: ${totalAccess}`);

  // Resolve FKs
  let skippedFk = 0;
  const candidates = [];

  for (const row of rawMate) {
    const puId = apuIdMap.get(text(row.CodPar));
    const recId = resourceMap.get(text(row.CodIns));
    if (!puId || !recId) { skippedFk++; continue; }
    const cantidad = toNumber(row.CanIns) * (1 + toNumber(row.Desper) / 100);
    const precio = resourcePriceMap.get(text(row.CodIns)) || 0;
    candidates.push({ puId, recId, tipo: 'material', cantidad: cantidad.toFixed(4), precio: precio.toFixed(4) });
  }

  for (const row of rawMano) {
    const puId = apuIdMap.get(text(row.CodPar));
    const recId = resourceMap.get(text(row.CodIns));
    if (!puId || !recId) { skippedFk++; continue; }
    const precio = resourcePriceMap.get(text(row.CodIns)) || 0;
    candidates.push({ puId, recId, tipo: 'mano_obra', cantidad: toNumber(row.CanIns).toFixed(4), precio: precio.toFixed(4) });
  }

  for (const row of rawEqui) {
    const puId = apuIdMap.get(text(row.CodPar));
    const recId = resourceMap.get(text(row.CodIns));
    if (!puId || !recId) { skippedFk++; continue; }
    const precio = resourcePriceMap.get(text(row.CodIns)) || 0;
    candidates.push({ puId, recId, tipo: 'equipo', cantidad: toNumber(row.CanIns).toFixed(4), precio: precio.toFixed(4) });
  }

  console.log(`  Resolved: ${candidates.length} | Missing FK (skip): ${skippedFk}`);

  // Load existing pairs in batches to avoid huge IN clauses
  const apuIds = [...new Set(candidates.map((c) => c.puId))];
  const existingPairs = new Set();

  if (apuIds.length) {
    console.log(`  Loading existing decomposition pairs for ${apuIds.length} APUs...`);
    for (const batch of chunk(apuIds, BATCH_SIZE)) {
      const placeholders = batch.map(() => '?').join(', ');
      const [rows] = await db.query(
        `SELECT precio_unitario_id, recurso_id FROM bim_apu_descomposicion WHERE precio_unitario_id IN (${placeholders})`,
        batch,
      );
      for (const row of rows) {
        existingPairs.add(`${row.precio_unitario_id}:${row.recurso_id}`);
      }
    }
    console.log(`  Existing pairs loaded: ${existingPairs.size}`);
  }

  const newCandidates = candidates.filter((c) => !existingPairs.has(`${c.puId}:${c.recId}`));
  const skippedExisting = candidates.length - newCandidates.length;
  console.log(`  Already exist (skip): ${skippedExisting} | New to insert: ${newCandidates.length}`);

  if (newCandidates.length) {
    // Assign sequential orden per APU
    const ordenCounters = new Map();
    const columns = ['precio_unitario_id', 'recurso_id', 'tipo', 'cantidad', 'precio_recurso', 'orden'];
    const rows = newCandidates.map((c) => {
      const orden = (ordenCounters.get(c.puId) || 0) + 1;
      ordenCounters.set(c.puId, orden);
      return [c.puId, c.recId, c.tipo, c.cantidad, c.precio, orden];
    });
    const result = await batchInsert(db, 'bim_apu_descomposicion', columns, rows);
    console.log(`  Inserted: ${result.inserted}`);
  }

  console.log(`  Phase 3 done in ${elapsed(t0)}`);
  return { totalAccess, resolved: candidates.length, inserted: newCandidates.length, skippedFk, skippedExisting };
}

// ── Main ───────────────────────────────────────────────────

async function main() {
  console.log('=================================================');
  console.log('  Lulo -> BIM Platform Seeder (Full Import)');
  console.log('=================================================');
  console.log(`  MDB:      ${MDB_PATH}`);
  console.log(`  Database: ${process.env.DB_NAME || 'bim_platform'}`);
  console.log(`  Vigencia: ${VIGENCIA}`);

  const t0 = Date.now();

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'bim_platform',
  });

  try {
    await db.beginTransaction();

    console.log('\n=== PHASE 0: Tenant ===');
    const tenantId = await resolveTenantId(db);

    const phase1 = await importResources(db, tenantId);
    const phase2 = await importApus(db, tenantId);
    const phase3 = await importDecomposition(db, phase2.apuIdMap, phase1.resourceMap, phase1.resourcePriceMap);

    await db.commit();

    console.log('\n=================================================');
    console.log('  SEED COMPLETE');
    console.log('=================================================');
    console.log(JSON.stringify({
      tenant_id: tenantId,
      elapsed: elapsed(t0),
      resources: {
        from_access: phase1.totalAccess,
        inserted: phase1.inserted,
        skipped: phase1.skipped,
        total_in_db: phase1.resourceMap.size,
      },
      apus: {
        from_access: phase2.totalAccess,
        inserted: phase2.inserted,
        skipped: phase2.skipped,
        total_in_db: phase2.apuIdMap.size,
      },
      decomposition: {
        from_access: phase3.totalAccess,
        resolved: phase3.resolved,
        inserted: phase3.inserted,
        skipped_missing_fk: phase3.skippedFk,
        skipped_existing: phase3.skippedExisting,
      },
      totals: {
        inserted: phase1.inserted + phase2.inserted + phase3.inserted,
        skipped: phase1.skipped + phase2.skipped + phase3.skippedFk + phase3.skippedExisting,
      },
    }, null, 2));
  } catch (error) {
    await db.rollback();
    console.error('\n!! ROLLBACK — seed failed:');
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
