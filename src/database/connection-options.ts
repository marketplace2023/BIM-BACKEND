import type { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';

function readDatabaseUrl() {
  return process.env.DATABASE_URL ?? process.env.MYSQL_URL ?? null;
}

function buildFromUrl(databaseUrl: string): MysqlConnectionOptions {
  const url = new URL(databaseUrl);

  return {
    type: 'mysql',
    host: url.hostname,
    port: Number(url.port || 3306),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
  };
}

function buildFromDiscreteEnv(): MysqlConnectionOptions {
  return {
    type: 'mysql',
    host: process.env.MYSQLHOST ?? process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.MYSQLPORT ?? process.env.DB_PORT ?? 3306),
    username: process.env.MYSQLUSER ?? process.env.DB_USER ?? 'root',
    password: process.env.MYSQLPASSWORD ?? process.env.DB_PASS ?? '',
    database: process.env.MYSQLDATABASE ?? process.env.DB_NAME ?? 'bim_platform',
  };
}

function getDatabaseConnectionOptions(): MysqlConnectionOptions {
  const databaseUrl = readDatabaseUrl();

  if (databaseUrl) {
    return buildFromUrl(databaseUrl);
  }

  return buildFromDiscreteEnv();
}

export { getDatabaseConnectionOptions };
