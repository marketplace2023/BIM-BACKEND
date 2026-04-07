import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Moves vertical-specific fields out of product_template (master table)
 * and into their corresponding vertical tables.
 *
 * product_template  ← only truly shared fields
 *   ├── contractor_service  ← service_type, delivery_mode  (was x_service_type, x_delivery_mode)
 *   ├── professional_service ← service_type  (was x_service_type)
 *   └── seo_service          ← delivery_mode  (was x_delivery_mode)
 */
export class MoveVerticalFieldsFromProductTemplate1773600000000 implements MigrationInterface {
  name = 'MoveVerticalFieldsFromProductTemplate1773600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Remove vertical-specific columns from the master table ────────
    await queryRunner.query(
      `ALTER TABLE \`product_template\` DROP COLUMN \`x_service_type\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_template\` DROP COLUMN \`x_delivery_mode\``,
    );

    // ── 2. contractor_service: add service_type + delivery_mode ──────────
    await queryRunner.query(
      `ALTER TABLE \`contractor_service\`
             ADD \`service_type\`  varchar(80)  NULL AFTER \`product_tmpl_id\`,
             ADD \`delivery_mode\` varchar(50)  NULL DEFAULT 'on_site' AFTER \`service_type\``,
    );

    // ── 3. professional_service: add service_type ────────────────────────
    await queryRunner.query(
      `ALTER TABLE \`professional_service\`
             ADD \`service_type\` varchar(80) NULL AFTER \`product_tmpl_id\``,
    );

    // ── 4. seo_service: add delivery_mode ────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE \`seo_service\`
             ADD \`delivery_mode\` varchar(50) NULL DEFAULT 'remote' AFTER \`service_scope\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse seo_service
    await queryRunner.query(
      `ALTER TABLE \`seo_service\` DROP COLUMN \`delivery_mode\``,
    );

    // Reverse professional_service
    await queryRunner.query(
      `ALTER TABLE \`professional_service\` DROP COLUMN \`service_type\``,
    );

    // Reverse contractor_service
    await queryRunner.query(
      `ALTER TABLE \`contractor_service\` DROP COLUMN \`delivery_mode\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`contractor_service\` DROP COLUMN \`service_type\``,
    );

    // Restore columns in product_template
    await queryRunner.query(
      `ALTER TABLE \`product_template\`
             ADD \`x_service_type\`  varchar(50) NULL,
             ADD \`x_delivery_mode\` varchar(50) NULL`,
    );
  }
}
