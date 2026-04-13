import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBimMediciones1776400000000 implements MigrationInterface {
  name = 'CreateBimMediciones1776400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE bim_mediciones (
        id bigint UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id bigint UNSIGNED NOT NULL,
        obra_id bigint UNSIGNED NOT NULL,
        partida_id bigint UNSIGNED NOT NULL,
        fecha_medicion date NOT NULL,
        cantidad_anterior decimal(14,4) NOT NULL DEFAULT '0.0000',
        cantidad_actual decimal(14,4) NOT NULL DEFAULT '0.0000',
        cantidad_acumulada decimal(14,4) NOT NULL DEFAULT '0.0000',
        porcentaje_avance decimal(7,2) NOT NULL DEFAULT '0.00',
        notas text NULL,
        measured_by bigint UNSIGNED NOT NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX idx_bim_mediciones_tenant (tenant_id),
        INDEX idx_bim_mediciones_obra (obra_id),
        INDEX idx_bim_mediciones_partida (partida_id),
        PRIMARY KEY (id),
        CONSTRAINT FK_bim_mediciones_obra FOREIGN KEY (obra_id) REFERENCES bim_obras(id) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT FK_bim_mediciones_partida FOREIGN KEY (partida_id) REFERENCES bim_partidas(id) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT FK_bim_mediciones_measured_by FOREIGN KEY (measured_by) REFERENCES res_users(id) ON DELETE RESTRICT ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE bim_mediciones');
  }
}
