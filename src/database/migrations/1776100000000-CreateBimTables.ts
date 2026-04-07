import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBimTables1776100000000 implements MigrationInterface {
  name = 'CreateBimTables1776100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── bim_users ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE \`bim_users\` (
        \`id\`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`email\`         VARCHAR(190)    NOT NULL,
        \`username\`      VARCHAR(120)    NOT NULL,
        \`password_hash\` VARCHAR(255)    NOT NULL,
        \`full_name\`     VARCHAR(200)    NOT NULL,
        \`role\`          VARCHAR(40)     NOT NULL DEFAULT 'consulta',
        \`avatar_url\`    VARCHAR(500)    NULL,
        \`is_active\`     TINYINT(1)      NOT NULL DEFAULT 1,
        \`last_login_at\` DATETIME        NULL,
        \`created_at\`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\`    DATETIME        NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_bim_users_email\`    (\`email\`),
        UNIQUE KEY \`uq_bim_users_username\` (\`username\`),
        INDEX \`idx_bim_users_role\`   (\`role\`),
        INDEX \`idx_bim_users_active\` (\`is_active\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ── bim_obras ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE \`bim_obras\` (
        \`id\`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`codigo\`              VARCHAR(60)     NOT NULL,
        \`nombre\`              VARCHAR(220)    NOT NULL,
        \`cliente\`             VARCHAR(220)    NOT NULL,
        \`ubicacion\`           VARCHAR(500)    NULL,
        \`fecha_inicio\`        DATE            NOT NULL,
        \`fecha_fin_estimada\`  DATE            NOT NULL,
        \`fecha_fin_real\`      DATE            NULL,
        \`estado\`              VARCHAR(30)     NOT NULL DEFAULT 'planificacion',
        \`moneda\`              CHAR(3)         NOT NULL DEFAULT 'USD',
        \`presupuesto_base\`    DECIMAL(16,2)   NOT NULL DEFAULT 0.00,
        \`descripcion\`         TEXT            NULL,
        \`meta_json\`           JSON            NULL,
        \`responsable_id\`      BIGINT UNSIGNED NOT NULL,
        \`created_by\`          BIGINT UNSIGNED NOT NULL,
        \`created_at\`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\`          DATETIME        NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_bim_obras_codigo\` (\`codigo\`),
        INDEX \`idx_bim_obras_estado\`    (\`estado\`),
        INDEX \`idx_bim_obras_cliente\`   (\`cliente\`),
        INDEX \`idx_bim_obras_nombre\`    (\`nombre\`),
        CONSTRAINT \`fk_bim_obras_responsable\` FOREIGN KEY (\`responsable_id\`) REFERENCES \`bim_users\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_bim_obras_created_by\`  FOREIGN KEY (\`created_by\`)     REFERENCES \`bim_users\` (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ── bim_contratistas ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE \`bim_contratistas\` (
        \`id\`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`nombre\`          VARCHAR(220)    NOT NULL,
        \`nombre_legal\`    VARCHAR(220)    NULL,
        \`rut_nif\`         VARCHAR(60)     NULL,
        \`tipo\`            VARCHAR(30)     NOT NULL DEFAULT 'empresa',
        \`contacto_nombre\` VARCHAR(200)    NULL,
        \`contacto_email\`  VARCHAR(190)    NULL,
        \`contacto_tel\`    VARCHAR(50)     NULL,
        \`direccion\`       VARCHAR(500)    NULL,
        \`ciudad\`          VARCHAR(120)    NULL,
        \`pais\`            VARCHAR(120)    NULL DEFAULT 'España',
        \`estado\`          VARCHAR(30)     NOT NULL DEFAULT 'activo',
        \`created_at\`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\`      DATETIME        NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_bim_cont_rut\` (\`rut_nif\`),
        INDEX \`idx_bim_cont_nombre\` (\`nombre\`),
        INDEX \`idx_bim_cont_estado\` (\`estado\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ── bim_obra_contratistas ─────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE \`bim_obra_contratistas\` (
        \`id\`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`obra_id\`        BIGINT UNSIGNED NOT NULL,
        \`contratista_id\` BIGINT UNSIGNED NOT NULL,
        \`rol\`            VARCHAR(80)     NULL,
        \`monto_contrato\` DECIMAL(16,2)   NULL,
        \`fecha_inicio\`   DATE            NULL,
        \`fecha_fin\`      DATE            NULL,
        \`estado\`         VARCHAR(30)     NOT NULL DEFAULT 'vigente',
        \`created_at\`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_obra_cont\` (\`obra_id\`, \`contratista_id\`),
        CONSTRAINT \`fk_boc_obra\`   FOREIGN KEY (\`obra_id\`)        REFERENCES \`bim_obras\`       (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_boc_cont\`   FOREIGN KEY (\`contratista_id\`) REFERENCES \`bim_contratistas\` (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ── bim_presupuestos ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE \`bim_presupuestos\` (
        \`id\`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`obra_id\`               BIGINT UNSIGNED NOT NULL,
        \`tipo\`                  VARCHAR(30)     NOT NULL DEFAULT 'obra',
        \`version\`               SMALLINT        NOT NULL DEFAULT 1,
        \`nombre\`                VARCHAR(220)    NOT NULL,
        \`descripcion\`           TEXT            NULL,
        \`estado\`                VARCHAR(30)     NOT NULL DEFAULT 'borrador',
        \`moneda\`                CHAR(3)         NOT NULL DEFAULT 'USD',
        \`total_presupuesto\`     DECIMAL(16,2)   NOT NULL DEFAULT 0.00,
        \`gastos_indirectos_pct\` DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
        \`beneficio_pct\`         DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
        \`iva_pct\`               DECIMAL(5,2)    NOT NULL DEFAULT 21.00,
        \`created_by\`            BIGINT UNSIGNED NOT NULL,
        \`aprobado_por\`          BIGINT UNSIGNED NULL,
        \`fecha_aprobacion\`      DATETIME        NULL,
        \`created_at\`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_pres_obra_estado\` (\`obra_id\`, \`estado\`),
        CONSTRAINT \`fk_bpres_obra\`        FOREIGN KEY (\`obra_id\`)     REFERENCES \`bim_obras\`  (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_bpres_created_by\`  FOREIGN KEY (\`created_by\`)  REFERENCES \`bim_users\`  (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_bpres_aprobado_por\` FOREIGN KEY (\`aprobado_por\`) REFERENCES \`bim_users\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ── bim_precios_unitarios ─────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE \`bim_precios_unitarios\` (
        \`id\`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`codigo\`      VARCHAR(60)     NOT NULL,
        \`descripcion\` TEXT            NOT NULL,
        \`unidad\`      VARCHAR(20)     NOT NULL,
        \`categoria\`   VARCHAR(60)     NULL,
        \`precio_base\` DECIMAL(14,4)   NOT NULL DEFAULT 0.0000,
        \`rendimiento\` DECIMAL(8,4)    NOT NULL DEFAULT 1.0000,
        \`vigencia\`    DATE            NOT NULL,
        \`activo\`      TINYINT(1)      NOT NULL DEFAULT 1,
        \`created_at\`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_bpu_codigo\`   (\`codigo\`),
        INDEX \`idx_bpu_categoria\`    (\`categoria\`),
        INDEX \`idx_bpu_activo\`       (\`activo\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ── bim_recursos ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE \`bim_recursos\` (
        \`id\`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`codigo\`      VARCHAR(60)     NOT NULL,
        \`descripcion\` VARCHAR(300)    NOT NULL,
        \`unidad\`      VARCHAR(20)     NOT NULL,
        \`tipo\`        VARCHAR(30)     NOT NULL,
        \`precio\`      DECIMAL(14,4)   NOT NULL DEFAULT 0.0000,
        \`vigencia\`    DATE            NOT NULL,
        \`activo\`      TINYINT(1)      NOT NULL DEFAULT 1,
        \`created_at\`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_brec_codigo\` (\`codigo\`),
        INDEX \`idx_brec_tipo\`       (\`tipo\`),
        INDEX \`idx_brec_activo\`     (\`activo\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ── bim_apu_descomposicion ────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE \`bim_apu_descomposicion\` (
        \`id\`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`precio_unitario_id\`  BIGINT UNSIGNED NOT NULL,
        \`recurso_id\`          BIGINT UNSIGNED NOT NULL,
        \`tipo\`                VARCHAR(30)     NOT NULL,
        \`cantidad\`            DECIMAL(14,4)   NOT NULL DEFAULT 0.0000,
        \`precio_recurso\`      DECIMAL(14,4)   NOT NULL DEFAULT 0.0000,
        \`importe_total\`       DECIMAL(16,2)   GENERATED ALWAYS AS (\`cantidad\` * \`precio_recurso\`) STORED,
        \`orden\`               SMALLINT        NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_apu_decom_pu\` (\`precio_unitario_id\`),
        CONSTRAINT \`fk_apu_pu\`  FOREIGN KEY (\`precio_unitario_id\`) REFERENCES \`bim_precios_unitarios\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_apu_rec\` FOREIGN KEY (\`recurso_id\`)         REFERENCES \`bim_recursos\`          (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ── bim_capitulos ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE \`bim_capitulos\` (
        \`id\`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`presupuesto_id\` BIGINT UNSIGNED NOT NULL,
        \`codigo\`         VARCHAR(30)     NOT NULL,
        \`nombre\`         VARCHAR(220)    NOT NULL,
        \`orden\`          SMALLINT        NOT NULL DEFAULT 0,
        \`parent_id\`      BIGINT UNSIGNED NULL,
        \`created_at\`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_cap_presupuesto\` (\`presupuesto_id\`),
        INDEX \`idx_cap_parent\`      (\`parent_id\`),
        CONSTRAINT \`fk_cap_presupuesto\` FOREIGN KEY (\`presupuesto_id\`) REFERENCES \`bim_presupuestos\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_cap_parent\`      FOREIGN KEY (\`parent_id\`)      REFERENCES \`bim_capitulos\`    (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ── bim_partidas ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE \`bim_partidas\` (
        \`id\`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`capitulo_id\`         BIGINT UNSIGNED NOT NULL,
        \`precio_unitario_id\`  BIGINT UNSIGNED NULL,
        \`codigo\`              VARCHAR(60)     NOT NULL,
        \`descripcion\`         TEXT            NOT NULL,
        \`unidad\`              VARCHAR(20)     NOT NULL,
        \`cantidad\`            DECIMAL(14,4)   NOT NULL DEFAULT 0.0000,
        \`precio_unitario\`     DECIMAL(14,4)   NOT NULL DEFAULT 0.0000,
        \`importe_total\`       DECIMAL(16,2)   GENERATED ALWAYS AS (\`cantidad\` * \`precio_unitario\`) STORED,
        \`observaciones\`       TEXT            NULL,
        \`orden\`               SMALLINT        NOT NULL DEFAULT 0,
        \`created_at\`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_partida_capitulo\` (\`capitulo_id\`),
        CONSTRAINT \`fk_partida_capitulo\` FOREIGN KEY (\`capitulo_id\`)        REFERENCES \`bim_capitulos\`        (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_partida_pu\`       FOREIGN KEY (\`precio_unitario_id\`) REFERENCES \`bim_precios_unitarios\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ── bim_certificaciones ───────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE \`bim_certificaciones\` (
        \`id\`                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`obra_id\`              BIGINT UNSIGNED NOT NULL,
        \`presupuesto_id\`       BIGINT UNSIGNED NOT NULL,
        \`numero\`               SMALLINT        NOT NULL,
        \`periodo_desde\`        DATE            NOT NULL,
        \`periodo_hasta\`        DATE            NOT NULL,
        \`estado\`               VARCHAR(30)     NOT NULL DEFAULT 'borrador',
        \`total_cert_anterior\`  DECIMAL(16,2)   NOT NULL DEFAULT 0.00,
        \`total_cert_actual\`    DECIMAL(16,2)   NOT NULL DEFAULT 0.00,
        \`total_cert_acumulado\` DECIMAL(16,2)   NOT NULL DEFAULT 0.00,
        \`porcentaje_avance\`    DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
        \`observaciones\`        TEXT            NULL,
        \`aprobado_por\`         BIGINT UNSIGNED NULL,
        \`fecha_aprobacion\`     DATETIME        NULL,
        \`created_by\`           BIGINT UNSIGNED NOT NULL,
        \`created_at\`           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\`           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_cert_obra_numero\` (\`obra_id\`, \`numero\`),
        INDEX \`idx_cert_obra_estado\` (\`obra_id\`, \`estado\`),
        CONSTRAINT \`fk_cert_obra\`        FOREIGN KEY (\`obra_id\`)        REFERENCES \`bim_obras\`        (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_cert_presupuesto\` FOREIGN KEY (\`presupuesto_id\`) REFERENCES \`bim_presupuestos\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_cert_aprobado\`    FOREIGN KEY (\`aprobado_por\`)   REFERENCES \`bim_users\`        (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_cert_created_by\`  FOREIGN KEY (\`created_by\`)     REFERENCES \`bim_users\`        (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ── bim_lineas_certificacion ──────────────────────────────
    await queryRunner.query(`
      CREATE TABLE \`bim_lineas_certificacion\` (
        \`id\`                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`certificacion_id\`     BIGINT UNSIGNED NOT NULL,
        \`partida_id\`           BIGINT UNSIGNED NOT NULL,
        \`cantidad_presupuesto\` DECIMAL(14,4)   NOT NULL DEFAULT 0.0000,
        \`cantidad_anterior\`    DECIMAL(14,4)   NOT NULL DEFAULT 0.0000,
        \`cantidad_actual\`      DECIMAL(14,4)   NOT NULL DEFAULT 0.0000,
        \`cantidad_acumulada\`   DECIMAL(14,4)   NOT NULL DEFAULT 0.0000,
        \`precio_unitario\`      DECIMAL(14,4)   NOT NULL DEFAULT 0.0000,
        \`importe_anterior\`     DECIMAL(16,2)   NOT NULL DEFAULT 0.00,
        \`importe_actual\`       DECIMAL(16,2)   NOT NULL DEFAULT 0.00,
        \`importe_acumulado\`    DECIMAL(16,2)   NOT NULL DEFAULT 0.00,
        \`porcentaje\`           DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_linea_cert_partida\` (\`certificacion_id\`, \`partida_id\`),
        CONSTRAINT \`fk_lc_cert\`    FOREIGN KEY (\`certificacion_id\`) REFERENCES \`bim_certificaciones\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_lc_partida\` FOREIGN KEY (\`partida_id\`)       REFERENCES \`bim_partidas\`        (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ── bim_obra_productos ────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE \`bim_obra_productos\` (
        \`id\`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`obra_id\`          BIGINT UNSIGNED NOT NULL,
        \`product_tmpl_id\`  BIGINT UNSIGNED NOT NULL,
        \`partida_id\`       BIGINT UNSIGNED NULL,
        \`descripcion_uso\`  VARCHAR(300)    NULL,
        \`cantidad\`         DECIMAL(14,4)   NOT NULL DEFAULT 1.0000,
        \`precio_referencia\` DECIMAL(14,4)  NULL,
        \`created_at\`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_bop_obra\`     (\`obra_id\`),
        CONSTRAINT \`fk_bop_obra\`     FOREIGN KEY (\`obra_id\`)         REFERENCES \`bim_obras\`        (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_bop_product\`  FOREIGN KEY (\`product_tmpl_id\`) REFERENCES \`product_template\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_bop_partida\`  FOREIGN KEY (\`partida_id\`)      REFERENCES \`bim_partidas\`     (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`bim_obra_productos\``);
    await queryRunner.query(
      `DROP TABLE IF EXISTS \`bim_lineas_certificacion\``,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS \`bim_certificaciones\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`bim_partidas\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`bim_capitulos\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`bim_apu_descomposicion\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`bim_recursos\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`bim_precios_unitarios\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`bim_presupuestos\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`bim_obra_contratistas\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`bim_contratistas\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`bim_obras\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`bim_users\``);
  }
}
