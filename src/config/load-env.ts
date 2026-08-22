import { existsSync, readFileSync } from 'node:fs';
import { buildDatabaseUrl, databaseFromEnv } from './database.config';

function applyEnvFile(filePath: string): void {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}

export function loadEnv(): void {
  applyEnvFile('.env');
  applyEnvFile(`.env.${process.env.NODE_ENV ?? 'development'}`);
  process.env.DATABASE_URL = buildDatabaseUrl(databaseFromEnv());
}

loadEnv();
