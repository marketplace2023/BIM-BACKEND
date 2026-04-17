import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBimComputoDocumentos1777200000000
  implements MigrationInterface
{
  name = 'CreateBimComputoDocumentos1777200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE bim_computo_documentos (
        id bigint UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id bigint UNSIGNED NOT NULL,
        obra_id bigint UNSIGNED NOT NULL,
        presupuesto_id bigint UNSIGNED NOT NULL,
        numero int UNSIGNED NOT NULL,
        fecha date NOT NULL,
        titulo varchar(220) NOT NULL,
        status varchar(30) NOT NULL DEFAULT 'borrador',
        observaciones text NULL,
        created_by bigint UNSIGNED NOT NULL,
        approved_by bigint UNSIGNED NULL,
        approved_at datetime NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX idx_bim_computo_docs_tenant (tenant_id),
        INDEX idx_bim_computo_docs_obra (obra_id),
        INDEX idx_bim_computo_docs_presupuesto (presupuesto_id),
        UNIQUE KEY uq_bim_computo_doc_numero (tenant_id, presupuesto_id, numero),
        PRIMARY KEY (id),
        CONSTRAINT FK_bim_computo_docs_obra FOREIGN KEY (obra_id) REFERENCES bim_obras(id) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT FK_bim_computo_docs_presupuesto FOREIGN KEY (presupuesto_id) REFERENCES bim_presupuestos(id) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT FK_bim_computo_docs_created_by FOREIGN KEY (created_by) REFERENCES res_users(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT FK_bim_computo_docs_approved_by FOREIGN KEY (approved_by) REFERENCES res_users(id) ON DELETE SET NULL ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      ALTER TABLE bim_computos
      ADD COLUMN documento_id bigint UNSIGNED NULL AFTER obra_id
    `);

    await queryRunner.query(`
      ALTER TABLE bim_computos
      ADD INDEX idx_bim_computos_documento (documento_id)
    `);

    await queryRunner.query(`
      ALTER TABLE bim_computos
      ADD CONSTRAINT FK_bim_computos_documento
      FOREIGN KEY (documento_id) REFERENCES bim_computo_documentos(id)
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bim_computos
      DROP FOREIGN KEY FK_bim_computos_documento
    `);
    await queryRunner.query(`
      ALTER TABLE bim_computos
      DROP INDEX idx_bim_computos_documento
    `);
    await queryRunner.query(`
      ALTER TABLE bim_computos
      DROP COLUMN documento_id
    `);
    await queryRunner.query('DROP TABLE bim_computo_documentos');
  }
}
