import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVerticalTypeToCategory1773500000000 implements MigrationInterface {
  name = 'AddVerticalTypeToCategory1773500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasVerticalType = await queryRunner.hasColumn(
      'product_public_category',
      'vertical_type',
    );

    if (!hasVerticalType) {
      await queryRunner.query(
        `ALTER TABLE \`product_public_category\` ADD \`vertical_type\` varchar(50) NOT NULL DEFAULT 'contractor' AFTER \`tenant_id\``,
      );
    }

    const table = await queryRunner.getTable('product_public_category');
    const uniqueSlugIndex = table?.indices.find(
      (index) => index.name === 'uq_cat_tenant_slug',
    );
    if (uniqueSlugIndex) {
      await queryRunner.query(
        `DROP INDEX \`uq_cat_tenant_slug\` ON \`product_public_category\``,
      );
    }

    await queryRunner.query(
      `ALTER TABLE \`product_public_category\` MODIFY \`vertical_type\` varchar(50) NOT NULL`,
    );

    const refreshedTable = await queryRunner.getTable('product_public_category');
    const hasVerticalSlugIndex = refreshedTable?.indices.some(
      (index) => index.name === 'uq_cat_tenant_vertical_slug',
    );
    const hasVerticalParentIndex = refreshedTable?.indices.some(
      (index) => index.name === 'idx_cat_tenant_vertical_parent',
    );

    if (!hasVerticalSlugIndex) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX \`uq_cat_tenant_vertical_slug\` ON \`product_public_category\` (\`tenant_id\`, \`vertical_type\`, \`slug\`)`,
      );
    }
    if (!hasVerticalParentIndex) {
      await queryRunner.query(
        `CREATE INDEX \`idx_cat_tenant_vertical_parent\` ON \`product_public_category\` (\`tenant_id\`, \`vertical_type\`, \`parent_id\`)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('product_public_category');
    const hasVerticalSlugIndex = table?.indices.find(
      (index) => index.name === 'uq_cat_tenant_vertical_slug',
    );
    const hasVerticalParentIndex = table?.indices.find(
      (index) => index.name === 'idx_cat_tenant_vertical_parent',
    );
    const hasLegacyUniqueIndex = table?.indices.find(
      (index) => index.name === 'uq_cat_tenant_slug',
    );
    const hasVerticalType = await queryRunner.hasColumn(
      'product_public_category',
      'vertical_type',
    );

    if (hasVerticalSlugIndex) {
      await queryRunner.query(
        `DROP INDEX \`uq_cat_tenant_vertical_slug\` ON \`product_public_category\``,
      );
    }
    if (hasVerticalParentIndex) {
      await queryRunner.query(
        `DROP INDEX \`idx_cat_tenant_vertical_parent\` ON \`product_public_category\``,
      );
    }

    if (hasVerticalType) {
      await queryRunner.query(
        `ALTER TABLE \`product_public_category\` DROP COLUMN \`vertical_type\``,
      );
    }

    if (!hasLegacyUniqueIndex) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX \`uq_cat_tenant_slug\` ON \`product_public_category\` (\`tenant_id\`, \`slug\`)`,
      );
    }
  }
}
