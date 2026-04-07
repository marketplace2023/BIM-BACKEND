import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommerceIntents1776000002000 implements MigrationInterface {
  name = 'AddCommerceIntents1776000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`commerce_intent\` (
        \`id\` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
        \`tenant_id\` bigint UNSIGNED NOT NULL,
        \`buyer_partner_id\` bigint UNSIGNED NOT NULL,
        \`store_partner_id\` bigint UNSIGNED NOT NULL,
        \`vertical_type\` varchar(40) NOT NULL,
        \`intent_type\` varchar(40) NOT NULL,
        \`status\` varchar(40) NOT NULL DEFAULT 'draft',
        \`currency_code\` char(3) NOT NULL DEFAULT 'USD',
        \`summary_json\` json NULL,
        \`converted_order_id\` bigint UNSIGNED NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_commerce_intent_buyer_status\` (\`buyer_partner_id\`, \`status\`),
        INDEX \`idx_commerce_intent_store_status\` (\`store_partner_id\`, \`status\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`commerce_intent_item\` (
        \`id\` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
        \`intent_id\` bigint UNSIGNED NOT NULL,
        \`product_tmpl_id\` bigint UNSIGNED NOT NULL,
        \`product_variant_id\` bigint UNSIGNED NULL,
        \`item_type\` varchar(40) NOT NULL,
        \`name_snapshot\` varchar(255) NOT NULL,
        \`price_snapshot\` decimal(12,2) NOT NULL DEFAULT '0.00',
        \`qty\` decimal(12,2) NOT NULL DEFAULT '1.00',
        \`payload_json\` json NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_commerce_intent_item_intent\` (\`intent_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `ALTER TABLE \`commerce_intent\`
        ADD CONSTRAINT \`FK_commerce_intent_tenant\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION,
        ADD CONSTRAINT \`FK_commerce_intent_buyer\` FOREIGN KEY (\`buyer_partner_id\`) REFERENCES \`res_partner\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION,
        ADD CONSTRAINT \`FK_commerce_intent_store\` FOREIGN KEY (\`store_partner_id\`) REFERENCES \`res_partner\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION,
        ADD CONSTRAINT \`FK_commerce_intent_order\` FOREIGN KEY (\`converted_order_id\`) REFERENCES \`sale_order\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`commerce_intent_item\`
        ADD CONSTRAINT \`FK_commerce_intent_item_intent\` FOREIGN KEY (\`intent_id\`) REFERENCES \`commerce_intent\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
        ADD CONSTRAINT \`FK_commerce_intent_item_product\` FOREIGN KEY (\`product_tmpl_id\`) REFERENCES \`product_template\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION,
        ADD CONSTRAINT \`FK_commerce_intent_item_variant\` FOREIGN KEY (\`product_variant_id\`) REFERENCES \`product_product\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`commerce_intent_item\` DROP FOREIGN KEY \`FK_commerce_intent_item_variant\``);
    await queryRunner.query(`ALTER TABLE \`commerce_intent_item\` DROP FOREIGN KEY \`FK_commerce_intent_item_product\``);
    await queryRunner.query(`ALTER TABLE \`commerce_intent_item\` DROP FOREIGN KEY \`FK_commerce_intent_item_intent\``);
    await queryRunner.query(`ALTER TABLE \`commerce_intent\` DROP FOREIGN KEY \`FK_commerce_intent_order\``);
    await queryRunner.query(`ALTER TABLE \`commerce_intent\` DROP FOREIGN KEY \`FK_commerce_intent_store\``);
    await queryRunner.query(`ALTER TABLE \`commerce_intent\` DROP FOREIGN KEY \`FK_commerce_intent_buyer\``);
    await queryRunner.query(`ALTER TABLE \`commerce_intent\` DROP FOREIGN KEY \`FK_commerce_intent_tenant\``);
    await queryRunner.query(`DROP TABLE \`commerce_intent_item\``);
    await queryRunner.query(`DROP TABLE \`commerce_intent\``);
  }
}
