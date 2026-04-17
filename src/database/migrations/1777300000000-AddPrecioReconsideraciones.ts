import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrecioReconsideraciones1777300000000
  implements MigrationInterface
{
  name = 'AddPrecioReconsideraciones1777300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bim_reconsideracion_documentos
      ADD COLUMN certificacion_id bigint UNSIGNED NULL AFTER presupuesto_id
    `);

    await queryRunner.query(`
      ALTER TABLE bim_reconsideracion_documentos
      ADD INDEX idx_bim_reconsideracion_docs_certificacion (certificacion_id)
    `);

    await queryRunner.query(`
      ALTER TABLE bim_reconsideracion_documentos
      ADD CONSTRAINT FK_bim_reconsideracion_docs_certificacion
      FOREIGN KEY (certificacion_id) REFERENCES bim_certificaciones(id)
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE bim_reconsideraciones
      ADD COLUMN precio_unitario_reconsiderado DECIMAL(14,4) NOT NULL DEFAULT 0.0000 AFTER precio_unitario
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bim_reconsideraciones
      DROP COLUMN precio_unitario_reconsiderado
    `);

    await queryRunner.query(`
      ALTER TABLE bim_reconsideracion_documentos
      DROP FOREIGN KEY FK_bim_reconsideracion_docs_certificacion
    `);

    await queryRunner.query(`
      ALTER TABLE bim_reconsideracion_documentos
      DROP INDEX idx_bim_reconsideracion_docs_certificacion
    `);

    await queryRunner.query(`
      ALTER TABLE bim_reconsideracion_documentos
      DROP COLUMN certificacion_id
    `);
  }
}
