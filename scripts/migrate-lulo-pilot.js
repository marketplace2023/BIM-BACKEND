/* eslint-disable no-console */
const { execFileSync } = require('child_process');
const path = require('path');
const mysql = require('mysql2/promise');

const MDB_PATH = path.resolve('C:/Users/username/BIM-SOFTWARE/LuloWinNG/LULO.MDB');
const ACCESS_QUERY_SCRIPT = path.resolve(__dirname, 'access-query.ps1');
const PS32 = path.join(process.env.WINDIR || 'C:/Windows', 'SysWOW64', 'WindowsPowerShell', 'v1.0', 'powershell.exe');

const TENANT_ID = Number(process.env.MIGRATION_TENANT_ID || 1);
const APU_LIMIT = Number(process.env.MIGRATION_APU_LIMIT || 100);
const VIGENCIA = new Date().toISOString().slice(0, 10);

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

function buildInClause(values) {
  return values.map((value) => `'${String(value).replace(/'/g, "''")}'`).join(', ');
}

async function main() {
  const apus = runAccessQuery(
    `SELECT TOP ${APU_LIMIT} CodPar, Descri, UniPar, RenPar, PreUni FROM ObraPart ORDER BY CodPar`,
  );

  if (!apus.length) {
    throw new Error('No se encontraron APU en ObraPart');
  }

  const apuCodes = apus.map((row) => text(row.CodPar)).filter(Boolean);
  const codeList = buildInClause(apuCodes);

  const decompMate = runAccessQuery(
    `SELECT CodPar, CodIns, CanIns, CosIns, Desper, CodFam FROM ObraApinMate WHERE CodPar IN (${codeList})`,
  );
  const decompMano = runAccessQuery(
    `SELECT CodPar, CodIns, CanIns, CosIns, CodFam FROM ObraApinMano WHERE CodPar IN (${codeList})`,
  );
  const decompEqui = runAccessQuery(
    `SELECT CodPar, CodIns, CanIns, CosIns, Deprec, CodFam FROM ObraApinEqui WHERE CodPar IN (${codeList})`,
  );

  const materialCodes = [...new Set(decompMate.map((row) => text(row.CodIns)).filter(Boolean))];
  const manoCodes = [...new Set(decompMano.map((row) => text(row.CodIns)).filter(Boolean))];
  const equipoCodes = [...new Set(decompEqui.map((row) => text(row.CodIns)).filter(Boolean))];

  const materiales = materialCodes.length
    ? runAccessQuery(
        `SELECT CodMat, Descri, UniMat, CosMat FROM ObraMate WHERE CodMat IN (${buildInClause(materialCodes)})`,
      )
    : [];
  const manos = manoCodes.length
    ? runAccessQuery(
        `SELECT CodMan, Descri, Salari FROM ObraMano WHERE CodMan IN (${buildInClause(manoCodes)})`,
      )
    : [];
  const equipos = equipoCodes.length
    ? runAccessQuery(
        `SELECT CodEqu, Descri, CosEqu FROM ObraEqui WHERE CodEqu IN (${buildInClause(equipoCodes)})`,
      )
    : [];

  const resources = [
    ...materiales.map((row) => ({
      codigo: text(row.CodMat),
      descripcion: text(row.Descri),
      unidad: text(row.UniMat) || 'und',
      tipo: 'material',
      precio: toNumber(row.CosMat).toFixed(4),
    })),
    ...manos.map((row) => ({
      codigo: text(row.CodMan),
      descripcion: text(row.Descri),
      unidad: 'jor',
      tipo: 'mano_obra',
      precio: toNumber(row.Salari).toFixed(4),
    })),
    ...equipos.map((row) => ({
      codigo: text(row.CodEqu),
      descripcion: text(row.Descri),
      unidad: 'dia',
      tipo: 'equipo',
      precio: toNumber(row.CosEqu).toFixed(4),
    })),
  ];

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'bim_platform',
  });

  try {
    await db.beginTransaction();

    const [tenantRows] = await db.query('SELECT id, slug, name FROM tenants WHERE id = ?', [TENANT_ID]);
    if (!tenantRows.length) {
      throw new Error(`Tenant ${TENANT_ID} no existe`);
    }

    const resourceMap = new Map();
    let insertedResources = 0;
    let skippedResources = 0;

    for (const resource of resources) {
      const [[existing]] = await db.query(
        'SELECT id FROM bim_recursos WHERE tenant_id = ? AND codigo = ? LIMIT 1',
        [TENANT_ID, resource.codigo],
      );

      if (existing) {
        resourceMap.set(resource.codigo, String(existing.id));
        skippedResources += 1;
        continue;
      }

      const [result] = await db.query(
        `INSERT INTO bim_recursos (tenant_id, codigo, descripcion, unidad, tipo, precio, vigencia, activo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [TENANT_ID, resource.codigo, resource.descripcion, resource.unidad, resource.tipo, resource.precio, VIGENCIA],
      );

      resourceMap.set(resource.codigo, String(result.insertId));
      insertedResources += 1;
    }

    const apuIdMap = new Map();
    let insertedApus = 0;
    let skippedApus = 0;

    for (const apu of apus) {
      const codigo = text(apu.CodPar);
      const [[existing]] = await db.query(
        'SELECT id FROM bim_precios_unitarios WHERE tenant_id = ? AND codigo = ? LIMIT 1',
        [TENANT_ID, codigo],
      );

      if (existing) {
        apuIdMap.set(codigo, String(existing.id));
        skippedApus += 1;
        continue;
      }

      const [result] = await db.query(
        `INSERT INTO bim_precios_unitarios (tenant_id, codigo, descripcion, unidad, categoria, precio_base, rendimiento, vigencia, activo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [
          TENANT_ID,
          codigo,
          text(apu.Descri),
          text(apu.UniPar) || 'und',
          categoriaFromCodigo(codigo),
          toNumber(apu.PreUni).toFixed(4),
          normalizeRendimiento(apu.RenPar),
          VIGENCIA,
        ],
      );

      apuIdMap.set(codigo, String(result.insertId));
      insertedApus += 1;
    }

    let insertedDecomp = 0;
    let skippedDecomp = 0;

    const allDecomp = [
      ...decompMate.map((row) => ({
        codigoApu: text(row.CodPar),
        codigoRecurso: text(row.CodIns),
        tipo: 'material',
        cantidad: (toNumber(row.CanIns) * (1 + toNumber(row.Desper) / 100)).toFixed(4),
        precio: toNumber(row.CosIns).toFixed(4),
      })),
      ...decompMano.map((row) => ({
        codigoApu: text(row.CodPar),
        codigoRecurso: text(row.CodIns),
        tipo: 'mano_obra',
        cantidad: toNumber(row.CanIns).toFixed(4),
        precio: toNumber(row.CosIns).toFixed(4),
      })),
      ...decompEqui.map((row) => ({
        codigoApu: text(row.CodPar),
        codigoRecurso: text(row.CodIns),
        tipo: 'equipo',
        cantidad: toNumber(row.CanIns).toFixed(4),
        precio: toNumber(row.CosIns).toFixed(4),
      })),
    ];

    for (const item of allDecomp) {
      const puId = apuIdMap.get(item.codigoApu);
      const recursoId = resourceMap.get(item.codigoRecurso);
      if (!puId || !recursoId) {
        skippedDecomp += 1;
        continue;
      }

      const [[existing]] = await db.query(
        'SELECT id FROM bim_apu_descomposicion WHERE precio_unitario_id = ? AND recurso_id = ? LIMIT 1',
        [puId, recursoId],
      );

      if (existing) {
        skippedDecomp += 1;
        continue;
      }

      await db.query(
        `INSERT INTO bim_apu_descomposicion (precio_unitario_id, recurso_id, tipo, cantidad, precio_recurso, orden)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [puId, recursoId, item.tipo, item.cantidad, item.precio],
      );
      insertedDecomp += 1;
    }

    await db.commit();

    console.log(
      JSON.stringify(
        {
          tenant_id: TENANT_ID,
          tenant: tenantRows[0],
          selected_apus: apus.length,
          referenced_resources: resources.length,
          inserted_resources: insertedResources,
          skipped_resources: skippedResources,
          inserted_apus: insertedApus,
          skipped_apus: skippedApus,
          inserted_descomposicion: insertedDecomp,
          skipped_descomposicion: skippedDecomp,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
