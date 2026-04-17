import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMedicionToCertificaciones1777500000000
  implements MigrationInterface
{
  name = 'AddMedicionToCertificaciones1777500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bim_certificaciones
      ADD COLUMN medicion_documento_id bigint UNSIGNED NULL AFTER presupuesto_id
    `);

    await queryRunner.query(`
      ALTER TABLE bim_certificaciones
      ADD INDEX idx_cert_medicion_documento (medicion_documento_id)
    `);

    await queryRunner.query(`
      ALTER TABLE bim_certificaciones
      ADD CONSTRAINT FK_bim_certificaciones_medicion_documento
      FOREIGN KEY (medicion_documento_id) REFERENCES bim_medicion_documentos(id)
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bim_certificaciones
      DROP FOREIGN KEY FK_bim_certificaciones_medicion_documento
    `);

    await queryRunner.query(`
      ALTER TABLE bim_certificaciones
      DROP INDEX idx_cert_medicion_documento
    `);

    await queryRunner.query(`
      ALTER TABLE bim_certificaciones
      DROP COLUMN medicion_documento_id
    `);
  }
}
