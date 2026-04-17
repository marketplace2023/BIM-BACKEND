import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExtraPartidas1777400000000 implements MigrationInterface {
  name = 'AddExtraPartidas1777400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bim_partidas
      ADD COLUMN es_extra TINYINT(1) NOT NULL DEFAULT 0 AFTER observaciones
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bim_partidas
      DROP COLUMN es_extra
    `);
  }
}
