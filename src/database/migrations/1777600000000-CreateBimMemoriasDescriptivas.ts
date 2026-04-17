import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBimMemoriasDescriptivas1777600000000
  implements MigrationInterface
{
  name = 'CreateBimMemoriasDescriptivas1777600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE bim_memorias_descriptivas (
        id bigint UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id bigint UNSIGNED NOT NULL,
        obra_id bigint UNSIGNED NOT NULL,
        presupuesto_id bigint UNSIGNED NOT NULL,
        partida_id bigint UNSIGNED NULL,
        tipo varchar(40) NOT NULL,
        titulo varchar(220) NOT NULL,
        contenido longtext NOT NULL,
        status varchar(30) NOT NULL DEFAULT 'borrador',
        created_by bigint UNSIGNED NOT NULL,
        created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_bim_memorias_tenant (tenant_id),
        INDEX idx_bim_memorias_obra (obra_id),
        INDEX idx_bim_memorias_presupuesto (presupuesto_id),
        CONSTRAINT FK_bim_memorias_obra FOREIGN KEY (obra_id) REFERENCES bim_obras(id) ON DELETE CASCADE,
        CONSTRAINT FK_bim_memorias_presupuesto FOREIGN KEY (presupuesto_id) REFERENCES bim_presupuestos(id) ON DELETE CASCADE,
        CONSTRAINT FK_bim_memorias_partida FOREIGN KEY (partida_id) REFERENCES bim_partidas(id) ON DELETE SET NULL,
        CONSTRAINT FK_bim_memorias_creator FOREIGN KEY (created_by) REFERENCES res_users(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE bim_memorias_descriptivas');
  }
}
