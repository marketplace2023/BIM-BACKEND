import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductImageTable1773700000000 implements MigrationInterface {
  name = 'CreateProductImageTable1773700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \
        \`product_image\` (\
          \`id\` bigint UNSIGNED NOT NULL AUTO_INCREMENT,\
          \`product_tmpl_id\` bigint UNSIGNED NOT NULL,\
          \`image_url\` varchar(500) NOT NULL,\
          \`file_name\` varchar(255) NULL,\
          \`original_name\` varchar(255) NULL,\
          \`mime_type\` varchar(120) NULL,\
          \`file_size\` int NULL,\
          \`sort_order\` int NOT NULL DEFAULT '0',\
          \`is_cover\` tinyint(1) NOT NULL DEFAULT '0',\
          \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\
          \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\
          INDEX \`idx_product_image_product_sort\` (\`product_tmpl_id\`, \`sort_order\`),\
          PRIMARY KEY (\`id\`),\
          CONSTRAINT \`fk_product_image_template\` FOREIGN KEY (\`product_tmpl_id\`) REFERENCES \`product_template\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION\
        ) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`product_image\``);
  }
}
