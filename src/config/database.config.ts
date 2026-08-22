import { registerAs } from '@nestjs/config';

export type DatabaseConnectionConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
  schema: string;
};

export function databaseFromEnv(): DatabaseConnectionConfig {
  return {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USERNAME ?? '',
    password: process.env.DATABASE_PASSWORD ?? '',
    name: process.env.DATABASE_NAME ?? '',
    schema: process.env.DATABASE_SCHEMA ?? 'public',
  };
}

export function buildDatabaseUrl(database: DatabaseConnectionConfig = databaseFromEnv()): string {
  const username = encodeURIComponent(database.username);
  const password = encodeURIComponent(database.password);
  return `postgresql://${username}:${password}@${database.host}:${String(database.port)}/${database.name}?schema=${database.schema}`;
}

export default registerAs('database', () => {
  const database = databaseFromEnv();
  return {
    ...database,
    url: buildDatabaseUrl(database),
  };
});
