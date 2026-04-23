import { MigrationInterface, QueryRunner } from 'typeorm';

export class FormalizePresupuestoOriginalAndModifiedSources1777800000000
  implements MigrationInterface
{
  name = 'FormalizePresupuestoOriginalAndModifiedSources1777800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bim_presupuestos
      ADD COLUMN es_oficial TINYINT(1) NOT NULL DEFAULT 0 AFTER version,
      ADD INDEX idx_pres_obra_tipo_oficial (obra_id, tipo, es_oficial)
    `);

    await queryRunner.query(`
      UPDATE bim_presupuestos base
      INNER JOIN (
        SELECT obra_id, tipo, MAX(id) AS presupuesto_id
        FROM bim_presupuestos
        WHERE tipo IN ('obra', 'sin_apu') AND estado = 'aprobado'
        GROUP BY obra_id, tipo
      ) picked ON picked.presupuesto_id = base.id
      SET base.es_oficial = 1
    `);

    await queryRunner.query(`
      UPDATE bim_presupuestos modif
      INNER JOIN (
        SELECT presupuesto_base_id, MAX(id) AS presupuesto_id
        FROM bim_presupuestos
        WHERE tipo = 'modificado'
        GROUP BY presupuesto_base_id
      ) picked ON picked.presupuesto_id = modif.id
      SET modif.es_oficial = 1
    `);

    await queryRunner.query(`
      CREATE TABLE bim_presupuesto_modificado_fuentes (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        presupuesto_id BIGINT UNSIGNED NOT NULL,
        documento_id BIGINT UNSIGNED NOT NULL,
        tipo_documento VARCHAR(30) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY idx_bpmf_unique (presupuesto_id, documento_id),
        KEY idx_bpmf_presupuesto (presupuesto_id),
        KEY idx_bpmf_documento (documento_id),
        CONSTRAINT fk_bpmf_presupuesto FOREIGN KEY (presupuesto_id) REFERENCES bim_presupuestos(id) ON DELETE CASCADE,
        CONSTRAINT fk_bpmf_documento FOREIGN KEY (documento_id) REFERENCES bim_reconsideracion_documentos(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      INSERT INTO bim_presupuesto_modificado_fuentes (tenant_id, presupuesto_id, documento_id, tipo_documento)
      SELECT modif.tenant_id, modif.id, doc.id, doc.tipo
      FROM bim_presupuestos modif
      INNER JOIN bim_reconsideracion_documentos doc
        ON doc.presupuesto_id = modif.presupuesto_base_id
      WHERE modif.tipo = 'modificado'
        AND doc.tipo IN ('aumento', 'disminucion', 'extra')
        AND doc.status IN ('revisado', 'aprobado')
      ON DUPLICATE KEY UPDATE tipo_documento = VALUES(tipo_documento)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS bim_presupuesto_modificado_fuentes`);

    await queryRunner.query(`
      ALTER TABLE bim_presupuestos
      DROP INDEX idx_pres_obra_tipo_oficial,
      DROP COLUMN es_oficial
    `);
  }
}
