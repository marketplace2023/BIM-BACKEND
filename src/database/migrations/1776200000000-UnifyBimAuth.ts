import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnifyBimAuth1776200000000 implements MigrationInterface {
  name = 'UnifyBimAuth1776200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop ALL FKs pointing to bim_users across every table
    const fksToBimUsers: { TABLE_NAME: string; CONSTRAINT_NAME: string }[] =
      await queryRunner.query(`
        SELECT TABLE_NAME, CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND REFERENCED_TABLE_NAME = 'bim_users'
      `);
    for (const fk of fksToBimUsers) {
      await queryRunner.query(
        `ALTER TABLE \`${fk.TABLE_NAME}\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``,
      );
    }

    // 2. Drop any FKs on bim_obras already pointing to res_users (idempotent re-run safety)
    const existingObrasResUserFks: { CONSTRAINT_NAME: string }[] =
      await queryRunner.query(`
        SELECT CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'bim_obras'
          AND REFERENCED_TABLE_NAME = 'res_users'
      `);
    for (const fk of existingObrasResUserFks) {
      await queryRunner.query(
        `ALTER TABLE bim_obras DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``,
      );
    }

    // 3. Add bim_obras → res_users FKs
    await queryRunner.query(`
      ALTER TABLE bim_obras
        ADD CONSTRAINT FK_bim_obras_responsable
          FOREIGN KEY (responsable_id) REFERENCES res_users(id) ON DELETE RESTRICT,
        ADD CONSTRAINT FK_bim_obras_creator
          FOREIGN KEY (created_by) REFERENCES res_users(id) ON DELETE RESTRICT
    `);

    // 4. Add bim_certificaciones → res_users FKs
    await queryRunner.query(`
      ALTER TABLE bim_certificaciones
        ADD CONSTRAINT FK_bim_cert_aprobado
          FOREIGN KEY (aprobado_por) REFERENCES res_users(id) ON DELETE SET NULL,
        ADD CONSTRAINT FK_bim_cert_created_by
          FOREIGN KEY (created_by) REFERENCES res_users(id) ON DELETE RESTRICT
    `);

    // 5. Add bim_presupuestos → res_users FKs
    await queryRunner.query(`
      ALTER TABLE bim_presupuestos
        ADD CONSTRAINT FK_bim_pres_aprobado
          FOREIGN KEY (aprobado_por) REFERENCES res_users(id) ON DELETE SET NULL,
        ADD CONSTRAINT FK_bim_pres_created_by
          FOREIGN KEY (created_by) REFERENCES res_users(id) ON DELETE RESTRICT
    `);

    // 6. Drop bim_users table (now safe — all FKs removed)
    await queryRunner.query(`DROP TABLE IF EXISTS bim_users`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate bim_users table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bim_users (
        id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        email     VARCHAR(180) NOT NULL,
        username  VARCHAR(60) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(180) NOT NULL,
        role      ENUM('admin','director_obra','jefe_produccion','administrativo','supervisor','consulta') NOT NULL DEFAULT 'consulta',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        last_login_at DATETIME NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at DATETIME(6) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_bim_users_email (email),
        UNIQUE KEY UQ_bim_users_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Remove res_user FKs from bim_obras (drop by scanning info_schema)
    const fks: { CONSTRAINT_NAME: string }[] = await queryRunner.query(`
      SELECT CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'bim_obras'
        AND REFERENCED_TABLE_NAME = 'res_user'
    `);
    for (const fk of fks) {
      await queryRunner.query(
        `ALTER TABLE bim_obras DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``,
      );
    }
  }
}
