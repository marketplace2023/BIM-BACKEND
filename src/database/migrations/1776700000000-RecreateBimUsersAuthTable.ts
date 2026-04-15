import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecreateBimUsersAuthTable1776700000000 implements MigrationInterface {
  name = 'RecreateBimUsersAuthTable1776700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bim_users (
        id bigint UNSIGNED NOT NULL AUTO_INCREMENT,
        email varchar(190) NOT NULL,
        username varchar(120) NOT NULL,
        password_hash varchar(255) NOT NULL,
        full_name varchar(200) NOT NULL,
        role varchar(40) NOT NULL DEFAULT 'consulta',
        avatar_url varchar(500) NULL,
        is_active tinyint(1) NOT NULL DEFAULT 1,
        last_login_at datetime NULL,
        created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at datetime NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_bim_users_email (email),
        UNIQUE KEY uq_bim_users_username (username),
        KEY idx_bim_users_role (role),
        KEY idx_bim_users_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS bim_users');
  }
}
