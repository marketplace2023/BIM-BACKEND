import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantIsolationToBim1776300000000 implements MigrationInterface {
  name = 'AddTenantIsolationToBim1776300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const defaultTenantSql = `COALESCE((SELECT id FROM tenants WHERE slug = 'marketplace-master' LIMIT 1), (SELECT id FROM tenants ORDER BY id ASC LIMIT 1))`;

    await queryRunner.query(
      `ALTER TABLE bim_obras ADD COLUMN tenant_id BIGINT UNSIGNED NULL AFTER id`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_contratistas ADD COLUMN tenant_id BIGINT UNSIGNED NULL AFTER id`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_presupuestos ADD COLUMN tenant_id BIGINT UNSIGNED NULL AFTER id`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_precios_unitarios ADD COLUMN tenant_id BIGINT UNSIGNED NULL AFTER id`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_recursos ADD COLUMN tenant_id BIGINT UNSIGNED NULL AFTER id`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_certificaciones ADD COLUMN tenant_id BIGINT UNSIGNED NULL AFTER id`,
    );

    await queryRunner.query(`
      UPDATE bim_obras obra
      INNER JOIN res_users creator ON creator.id = obra.created_by
      SET obra.tenant_id = creator.tenant_id
      WHERE obra.tenant_id IS NULL
    `);

    await queryRunner.query(`
      UPDATE bim_presupuestos presupuesto
      INNER JOIN bim_obras obra ON obra.id = presupuesto.obra_id
      SET presupuesto.tenant_id = obra.tenant_id
      WHERE presupuesto.tenant_id IS NULL
    `);

    await queryRunner.query(`
      UPDATE bim_presupuestos presupuesto
      INNER JOIN res_users creator ON creator.id = presupuesto.created_by
      SET presupuesto.tenant_id = creator.tenant_id
      WHERE presupuesto.tenant_id IS NULL
    `);

    await queryRunner.query(`
      UPDATE bim_certificaciones certificacion
      INNER JOIN bim_obras obra ON obra.id = certificacion.obra_id
      SET certificacion.tenant_id = obra.tenant_id
      WHERE certificacion.tenant_id IS NULL
    `);

    await queryRunner.query(
      `UPDATE bim_contratistas SET tenant_id = ${defaultTenantSql} WHERE tenant_id IS NULL`,
    );
    await queryRunner.query(
      `UPDATE bim_precios_unitarios SET tenant_id = ${defaultTenantSql} WHERE tenant_id IS NULL`,
    );
    await queryRunner.query(
      `UPDATE bim_recursos SET tenant_id = ${defaultTenantSql} WHERE tenant_id IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE bim_obras MODIFY tenant_id BIGINT UNSIGNED NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_contratistas MODIFY tenant_id BIGINT UNSIGNED NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_presupuestos MODIFY tenant_id BIGINT UNSIGNED NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_precios_unitarios MODIFY tenant_id BIGINT UNSIGNED NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_recursos MODIFY tenant_id BIGINT UNSIGNED NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_certificaciones MODIFY tenant_id BIGINT UNSIGNED NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE bim_obras DROP INDEX uq_bim_obras_codigo`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_contratistas DROP INDEX uq_bim_cont_rut`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_precios_unitarios DROP INDEX uq_bpu_codigo`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_recursos DROP INDEX uq_brec_codigo`,
    );

    await queryRunner.query(
      `ALTER TABLE bim_obras ADD INDEX idx_bim_obras_tenant (tenant_id)`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_contratistas ADD INDEX idx_bim_cont_tenant (tenant_id)`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_presupuestos ADD INDEX idx_pres_tenant (tenant_id)`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_precios_unitarios ADD INDEX idx_bpu_tenant (tenant_id)`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_recursos ADD INDEX idx_brec_tenant (tenant_id)`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_certificaciones ADD INDEX idx_cert_tenant (tenant_id)`,
    );

    await queryRunner.query(
      `ALTER TABLE bim_obras ADD CONSTRAINT uq_bim_obras_tenant_codigo UNIQUE (tenant_id, codigo)`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_contratistas ADD CONSTRAINT uq_bim_cont_tenant_rut UNIQUE (tenant_id, rut_nif)`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_precios_unitarios ADD CONSTRAINT uq_bpu_tenant_codigo UNIQUE (tenant_id, codigo)`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_recursos ADD CONSTRAINT uq_brec_tenant_codigo UNIQUE (tenant_id, codigo)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE bim_recursos DROP INDEX uq_brec_tenant_codigo`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_precios_unitarios DROP INDEX uq_bpu_tenant_codigo`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_contratistas DROP INDEX uq_bim_cont_tenant_rut`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_obras DROP INDEX uq_bim_obras_tenant_codigo`,
    );

    await queryRunner.query(
      `ALTER TABLE bim_certificaciones DROP INDEX idx_cert_tenant`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_recursos DROP INDEX idx_brec_tenant`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_precios_unitarios DROP INDEX idx_bpu_tenant`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_presupuestos DROP INDEX idx_pres_tenant`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_contratistas DROP INDEX idx_bim_cont_tenant`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_obras DROP INDEX idx_bim_obras_tenant`,
    );

    await queryRunner.query(
      `ALTER TABLE bim_obras ADD CONSTRAINT uq_bim_obras_codigo UNIQUE (codigo)`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_contratistas ADD CONSTRAINT uq_bim_cont_rut UNIQUE (rut_nif)`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_precios_unitarios ADD CONSTRAINT uq_bpu_codigo UNIQUE (codigo)`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_recursos ADD CONSTRAINT uq_brec_codigo UNIQUE (codigo)`,
    );

    await queryRunner.query(
      `ALTER TABLE bim_certificaciones DROP COLUMN tenant_id`,
    );
    await queryRunner.query(`ALTER TABLE bim_recursos DROP COLUMN tenant_id`);
    await queryRunner.query(
      `ALTER TABLE bim_precios_unitarios DROP COLUMN tenant_id`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_presupuestos DROP COLUMN tenant_id`,
    );
    await queryRunner.query(
      `ALTER TABLE bim_contratistas DROP COLUMN tenant_id`,
    );
    await queryRunner.query(`ALTER TABLE bim_obras DROP COLUMN tenant_id`);
  }
}
