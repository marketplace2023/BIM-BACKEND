import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPresupuestoBaseToBimPresupuestos1777700000000
  implements MigrationInterface
{
  name = 'AddPresupuestoBaseToBimPresupuestos1777700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bim_presupuestos
      ADD COLUMN presupuesto_base_id BIGINT UNSIGNED NULL AFTER obra_id,
      ADD INDEX idx_pres_base (presupuesto_base_id),
      ADD CONSTRAINT fk_bpres_presupuesto_base
        FOREIGN KEY (presupuesto_base_id)
        REFERENCES bim_presupuestos (id)
        ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bim_presupuestos
      DROP FOREIGN KEY fk_bpres_presupuesto_base,
      DROP INDEX idx_pres_base,
      DROP COLUMN presupuesto_base_id
    `);
  }
}
