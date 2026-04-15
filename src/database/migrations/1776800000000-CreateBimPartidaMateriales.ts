import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBimPartidaMateriales1776800000000
  implements MigrationInterface
{
  name = 'CreateBimPartidaMateriales1776800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE bim_partida_materiales (
        id bigint UNSIGNED NOT NULL AUTO_INCREMENT,
        partida_id bigint UNSIGNED NOT NULL,
        recurso_id bigint UNSIGNED NULL,
        codigo varchar(60) NOT NULL,
        descripcion varchar(300) NOT NULL,
        unidad varchar(20) NOT NULL,
        cantidad decimal(14,4) NOT NULL DEFAULT '0.0000',
        costo decimal(14,4) NOT NULL DEFAULT '0.0000',
        desperdicio_pct decimal(8,4) NOT NULL DEFAULT '0.0000',
        total decimal(16,2) GENERATED ALWAYS AS ((cantidad * costo) * (1 + (desperdicio_pct / 100))) STORED,
        orden smallint NOT NULL DEFAULT 0,
        INDEX idx_bpm_partida (partida_id),
        INDEX idx_bpm_recurso (recurso_id),
        PRIMARY KEY (id),
        CONSTRAINT FK_bpm_partida FOREIGN KEY (partida_id) REFERENCES bim_partidas(id) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT FK_bpm_recurso FOREIGN KEY (recurso_id) REFERENCES bim_recursos(id) ON DELETE SET NULL ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE bim_partida_materiales');
  }
}
