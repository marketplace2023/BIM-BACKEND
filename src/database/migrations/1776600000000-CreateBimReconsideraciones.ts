import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBimReconsideraciones1776600000000 implements MigrationInterface {
  name = 'CreateBimReconsideraciones1776600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE bim_reconsideraciones (
        id bigint UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id bigint UNSIGNED NOT NULL,
        obra_id bigint UNSIGNED NOT NULL,
        partida_id bigint UNSIGNED NOT NULL,
        tipo varchar(30) NOT NULL DEFAULT 'aumento',
        descripcion varchar(220) NOT NULL,
        cantidad_original decimal(14,4) NOT NULL DEFAULT '0.0000',
        cantidad_variacion decimal(14,4) NOT NULL DEFAULT '0.0000',
        cantidad_nueva decimal(14,4) NOT NULL DEFAULT '0.0000',
        precio_unitario decimal(14,4) NOT NULL DEFAULT '0.0000',
        monto_variacion decimal(16,2) NOT NULL DEFAULT '0.00',
        justificacion text NULL,
        status varchar(30) NOT NULL DEFAULT 'borrador',
        created_by bigint UNSIGNED NOT NULL,
        approved_by bigint UNSIGNED NULL,
        approved_at datetime NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX idx_bim_reconsideraciones_tenant (tenant_id),
        INDEX idx_bim_reconsideraciones_obra (obra_id),
        INDEX idx_bim_reconsideraciones_partida (partida_id),
        PRIMARY KEY (id),
        CONSTRAINT FK_bim_reconsideraciones_obra FOREIGN KEY (obra_id) REFERENCES bim_obras(id) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT FK_bim_reconsideraciones_partida FOREIGN KEY (partida_id) REFERENCES bim_partidas(id) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT FK_bim_reconsideraciones_created_by FOREIGN KEY (created_by) REFERENCES res_users(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT FK_bim_reconsideraciones_approved_by FOREIGN KEY (approved_by) REFERENCES res_users(id) ON DELETE SET NULL ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE bim_reconsideraciones');
  }
}
