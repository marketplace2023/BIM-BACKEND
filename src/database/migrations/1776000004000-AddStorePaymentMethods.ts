import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStorePaymentMethods1776000004000 implements MigrationInterface {
  name = 'AddStorePaymentMethods1776000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`store_payment_method\` (
        \`id\` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
        \`tenant_id\` bigint UNSIGNED NOT NULL,
        \`partner_id\` bigint UNSIGNED NOT NULL,
        \`provider\` varchar(60) NOT NULL,
        \`method_type\` varchar(60) NOT NULL,
        \`title\` varchar(160) NOT NULL,
        \`instructions\` text NULL,
        \`account_holder\` varchar(180) NULL,
        \`account_number_masked\` varchar(80) NULL,
        \`phone\` varchar(50) NULL,
        \`email\` varchar(190) NULL,
        \`checkout_url\` varchar(500) NULL,
        \`payload_json\` json NULL,
        \`is_enabled\` tinyint(1) NOT NULL DEFAULT '1',
        \`is_default\` tinyint(1) NOT NULL DEFAULT '0',
        \`verification_status\` varchar(30) NOT NULL DEFAULT 'verified',
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `ALTER TABLE \`store_payment_method\`
        ADD CONSTRAINT \`FK_store_payment_method_tenant\`
        FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION,
        ADD CONSTRAINT \`FK_store_payment_method_partner\`
        FOREIGN KEY (\`partner_id\`) REFERENCES \`res_partner\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`store_payment_method\` DROP FOREIGN KEY \`FK_store_payment_method_partner\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`store_payment_method\` DROP FOREIGN KEY \`FK_store_payment_method_tenant\``,
    );
    await queryRunner.query(`DROP TABLE \`store_payment_method\``);
  }
}
