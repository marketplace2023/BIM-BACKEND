import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderPaymentFields1776000005000 implements MigrationInterface {
  name = 'AddOrderPaymentFields1776000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`sale_order\`
        ADD \`payment_status\` varchar(40) NOT NULL DEFAULT 'unpaid',
        ADD \`payment_method_id\` bigint UNSIGNED NULL,
        ADD \`payment_reference\` varchar(180) NULL,
        ADD \`payment_proof_url\` varchar(500) NULL,
        ADD \`payment_notes\` text NULL,
        ADD \`paid_at\` datetime NULL,
        ADD \`validated_by_store_user_id\` bigint UNSIGNED NULL,
        ADD \`validated_at\` datetime NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE \`sale_order\`
        ADD CONSTRAINT \`FK_sale_order_payment_method\`
        FOREIGN KEY (\`payment_method_id\`) REFERENCES \`store_payment_method\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`sale_order\` DROP FOREIGN KEY \`FK_sale_order_payment_method\``);
    await queryRunner.query(
      `ALTER TABLE \`sale_order\`
        DROP COLUMN \`validated_at\`,
        DROP COLUMN \`validated_by_store_user_id\`,
        DROP COLUMN \`paid_at\`,
        DROP COLUMN \`payment_notes\`,
        DROP COLUMN \`payment_proof_url\`,
        DROP COLUMN \`payment_reference\`,
        DROP COLUMN \`payment_method_id\`,
        DROP COLUMN \`payment_status\``,
    );
  }
}
