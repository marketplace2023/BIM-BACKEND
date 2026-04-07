import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRatingReplies1776000001000 implements MigrationInterface {
  name = 'AddRatingReplies1776000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`rating_rating\`
        ADD \`replier_user_id\` bigint UNSIGNED NULL,
        ADD \`reply_comment\` text NULL,
        ADD \`reply_created_at\` datetime NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`rating_rating\`
        ADD CONSTRAINT \`FK_rating_reply_user\`
        FOREIGN KEY (\`replier_user_id\`) REFERENCES \`res_users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`rating_rating\` DROP FOREIGN KEY \`FK_rating_reply_user\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`rating_rating\`
        DROP COLUMN \`reply_created_at\`,
        DROP COLUMN \`reply_comment\`,
        DROP COLUMN \`replier_user_id\``,
    );
  }
}
