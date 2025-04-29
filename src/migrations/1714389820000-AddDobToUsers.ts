import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDobToUsers1714389820000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, add the column as nullable
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN "dob" date NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN "dob"
    `);
  }
} 