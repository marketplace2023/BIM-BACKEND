import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBimComputos1776500000000 implements MigrationInterface {
  name = 'CreateBimComputos1776500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE bim_computos (
        id bigint UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id bigint UNSIGNED NOT NULL,
        obra_id bigint UNSIGNED NOT NULL,
        partida_id bigint UNSIGNED NOT NULL,
        descripcion varchar(220) NOT NULL,
        formula_tipo varchar(30) NOT NULL DEFAULT 'directo',
        cantidad decimal(14,4) NOT NULL DEFAULT '0.0000',
        largo decimal(14,4) NOT NULL DEFAULT '0.0000',
        ancho decimal(14,4) NOT NULL DEFAULT '0.0000',
        alto decimal(14,4) NOT NULL DEFAULT '0.0000',
        resultado decimal(16,4) NOT NULL DEFAULT '0.0000',
        notas text NULL,
        created_by bigint UNSIGNED NOT NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX idx_bim_computos_tenant (tenant_id),
        INDEX idx_bim_computos_obra (obra_id),
        INDEX idx_bim_computos_partida (partida_id),
        PRIMARY KEY (id),
        CONSTRAINT FK_bim_computos_obra FOREIGN KEY (obra_id) REFERENCES bim_obras(id) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT FK_bim_computos_partida FOREIGN KEY (partida_id) REFERENCES bim_partidas(id) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT FK_bim_computos_created_by FOREIGN KEY (created_by) REFERENCES res_users(id) ON DELETE RESTRICT ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE bim_computos');
  }
}
