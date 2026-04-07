import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourseCurriculumFields1776000000000 implements MigrationInterface {
  name = 'AddCourseCurriculumFields1776000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \
        \`course\` \
        ADD \`learning_outcomes_json\` json NULL, \
        ADD \`requirements_json\` json NULL, \
        ADD \`curriculum_json\` json NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \
        \`course\` \
        DROP COLUMN \`curriculum_json\`, \
        DROP COLUMN \`requirements_json\`, \
        DROP COLUMN \`learning_outcomes_json\``,
    );
  }
}
