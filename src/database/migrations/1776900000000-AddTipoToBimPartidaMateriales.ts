import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTipoToBimPartidaMateriales1776900000000
  implements MigrationInterface
{
  name = 'AddTipoToBimPartidaMateriales1776900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bim_partida_materiales
      ADD COLUMN tipo varchar(30) NOT NULL DEFAULT 'material' AFTER recurso_id
    `);
    await queryRunner.query(`
      CREATE INDEX idx_bpm_tipo ON bim_partida_materiales (tipo)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX idx_bpm_tipo ON bim_partida_materiales');
    await queryRunner.query(`
      ALTER TABLE bim_partida_materiales
      DROP COLUMN tipo
    `);
  }
}
