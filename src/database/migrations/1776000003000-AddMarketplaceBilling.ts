import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMarketplaceBilling1776000003000 implements MigrationInterface {
  name = 'AddMarketplaceBilling1776000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`marketplace_plan\` (
        \`id\` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
        \`tenant_id\` bigint UNSIGNED NOT NULL,
        \`code\` varchar(60) NOT NULL,
        \`name\` varchar(160) NOT NULL,
        \`description\` text NULL,
        \`billing_type\` varchar(30) NOT NULL DEFAULT 'one_time',
        \`amount\` decimal(12,2) NOT NULL DEFAULT '0.00',
        \`currency_code\` char(3) NOT NULL DEFAULT 'USD',
        \`features_json\` json NULL,
        \`is_active\` tinyint(1) NOT NULL DEFAULT '1',
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`partner_listing_subscription\` (
        \`id\` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
        \`tenant_id\` bigint UNSIGNED NOT NULL,
        \`partner_id\` bigint UNSIGNED NOT NULL,
        \`plan_id\` bigint UNSIGNED NOT NULL,
        \`status\` varchar(40) NOT NULL DEFAULT 'draft',
        \`starts_at\` datetime NULL,
        \`expires_at\` datetime NULL,
        \`is_auto_renew\` tinyint(1) NOT NULL DEFAULT '0',
        \`activated_by_admin_user_id\` bigint UNSIGNED NULL,
        \`activated_at\` datetime NULL,
        \`notes\` text NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`partner_listing_payment\` (
        \`id\` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
        \`tenant_id\` bigint UNSIGNED NOT NULL,
        \`partner_id\` bigint UNSIGNED NOT NULL,
        \`subscription_id\` bigint UNSIGNED NOT NULL,
        \`provider\` varchar(60) NOT NULL,
        \`provider_ref\` varchar(120) NULL,
        \`status\` varchar(40) NOT NULL DEFAULT 'draft',
        \`amount\` decimal(12,2) NOT NULL DEFAULT '0.00',
        \`currency_code\` char(3) NOT NULL DEFAULT 'USD',
        \`payment_context\` varchar(40) NOT NULL DEFAULT 'listing_publication',
        \`proof_url\` varchar(500) NULL,
        \`payload_json\` json NULL,
        \`paid_at\` datetime NULL,
        \`validated_by_admin_user_id\` bigint UNSIGNED NULL,
        \`validated_at\` datetime NULL,
        \`validation_notes\` text NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `ALTER TABLE \`marketplace_plan\`
        ADD CONSTRAINT \`FK_marketplace_plan_tenant\`
        FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`partner_listing_subscription\`
        ADD CONSTRAINT \`FK_listing_subscription_tenant\`
        FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION,
        ADD CONSTRAINT \`FK_listing_subscription_partner\`
        FOREIGN KEY (\`partner_id\`) REFERENCES \`res_partner\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION,
        ADD CONSTRAINT \`FK_listing_subscription_plan\`
        FOREIGN KEY (\`plan_id\`) REFERENCES \`marketplace_plan\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION,
        ADD CONSTRAINT \`FK_listing_subscription_admin\`
        FOREIGN KEY (\`activated_by_admin_user_id\`) REFERENCES \`res_users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`partner_listing_payment\`
        ADD CONSTRAINT \`FK_listing_payment_tenant\`
        FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION,
        ADD CONSTRAINT \`FK_listing_payment_partner\`
        FOREIGN KEY (\`partner_id\`) REFERENCES \`res_partner\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION,
        ADD CONSTRAINT \`FK_listing_payment_subscription\`
        FOREIGN KEY (\`subscription_id\`) REFERENCES \`partner_listing_subscription\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
        ADD CONSTRAINT \`FK_listing_payment_admin\`
        FOREIGN KEY (\`validated_by_admin_user_id\`) REFERENCES \`res_users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`partner_listing_payment\` DROP FOREIGN KEY \`FK_listing_payment_admin\``);
    await queryRunner.query(`ALTER TABLE \`partner_listing_payment\` DROP FOREIGN KEY \`FK_listing_payment_subscription\``);
    await queryRunner.query(`ALTER TABLE \`partner_listing_payment\` DROP FOREIGN KEY \`FK_listing_payment_partner\``);
    await queryRunner.query(`ALTER TABLE \`partner_listing_payment\` DROP FOREIGN KEY \`FK_listing_payment_tenant\``);
    await queryRunner.query(`ALTER TABLE \`partner_listing_subscription\` DROP FOREIGN KEY \`FK_listing_subscription_admin\``);
    await queryRunner.query(`ALTER TABLE \`partner_listing_subscription\` DROP FOREIGN KEY \`FK_listing_subscription_plan\``);
    await queryRunner.query(`ALTER TABLE \`partner_listing_subscription\` DROP FOREIGN KEY \`FK_listing_subscription_partner\``);
    await queryRunner.query(`ALTER TABLE \`partner_listing_subscription\` DROP FOREIGN KEY \`FK_listing_subscription_tenant\``);
    await queryRunner.query(`ALTER TABLE \`marketplace_plan\` DROP FOREIGN KEY \`FK_marketplace_plan_tenant\``);
    await queryRunner.query(`DROP TABLE \`partner_listing_payment\``);
    await queryRunner.query(`DROP TABLE \`partner_listing_subscription\``);
    await queryRunner.query(`DROP TABLE \`marketplace_plan\``);
  }
}
