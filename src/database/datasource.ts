import 'dotenv/config';
import { DataSource } from 'typeorm';
import { getDatabaseConnectionOptions } from './connection-options';

export default new DataSource({
  ...getDatabaseConnectionOptions(),
  charset: 'utf8mb4',
  entities: [__dirname + '/entities/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  migrationsRun: false,
});
