import Joi from 'joi';
import { buildDatabaseUrl, databaseFromEnv } from './database.config';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'staging', 'production', 'test').required(),
  PORT: Joi.number().port().required(),
  APP_URL: Joi.string().uri().required(),
  CORS_ORIGINS: Joi.string().required(),
  TRUST_PROXY: Joi.boolean().default(true),

  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().port().required(),
  DATABASE_USERNAME: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().allow('').default(''),
  DATABASE_NAME: Joi.string().required(),
  DATABASE_SCHEMA: Joi.string().default('public'),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().required(),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  THROTTLE_TTL_MS: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(20),
  THROTTLE_AUTH_TTL_MS: Joi.number().default(60000),
  THROTTLE_AUTH_LIMIT: Joi.number().default(5),

  ADMIN_EMAIL: Joi.string().email().required(),
  ADMIN_PASSWORD: Joi.string().required(),
});

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const { error, value } = envValidationSchema.validate(config, {
    abortEarly: false,
    allowUnknown: true,
    convert: true,
  });

  if (error) {
    throw new Error(`Config validation error: ${error.message}`);
  }

  const validated = value as Record<string, unknown>;

  process.env.DATABASE_HOST = envString(validated['DATABASE_HOST']);
  process.env.DATABASE_PORT = envString(validated['DATABASE_PORT']);
  process.env.DATABASE_USERNAME = envString(validated['DATABASE_USERNAME']);
  process.env.DATABASE_PASSWORD = envString(validated['DATABASE_PASSWORD']);
  process.env.DATABASE_NAME = envString(validated['DATABASE_NAME']);
  process.env.DATABASE_SCHEMA = envString(validated['DATABASE_SCHEMA'], 'public');

  const url = buildDatabaseUrl(databaseFromEnv());
  process.env.DATABASE_URL = url;
  validated['DATABASE_URL'] = url;

  return validated;
}

function envString(value: unknown, fallback = ''): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return fallback;
}
