'use strict';

const path = require('node:path');
const dotenv = require('dotenv');
const { z } = require('zod');

if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

const FORBIDDEN_PLACEHOLDERS = new Set([
  '', 'changeme', 'change-me', 'secret', 'hello', 'hello world',
  'password', 'test', 'replace-me',
]);

const notPlaceholder = (value) =>
  !FORBIDDEN_PLACEHOLDERS.has(String(value).trim().toLowerCase()) &&
  !String(value).toLowerCase().startsWith('replace-me');

const secret32 = z.string().min(32).refine(notPlaceholder, 'looks like a placeholder value');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),

  DATABASE_URL: z.string().min(1).refine(
    (v) => v.startsWith('postgres://') || v.startsWith('postgresql://'),
    { message: 'must be a postgresql:// connection string' }
  ),

  JWT_ACCESS_SECRET: secret32,
  JWT_REFRESH_SECRET: secret32,
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(14).default(12),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(5),

  EXCHANGE_PROVIDER: z.enum(['mock', 'live']).default('mock'),
  EXCHANGE_API_KEY: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Saukele <onboarding@resend.dev>'),
  APP_URL: z.string().default('http://localhost:3000'),

  REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  ADMIN_REGISTRATION_KEY: z.string().min(16).optional(),
})
.superRefine((cfg, ctx) => {
  if (cfg.JWT_ACCESS_SECRET === cfg.JWT_REFRESH_SECRET) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_REFRESH_SECRET'], message: 'must differ from JWT_ACCESS_SECRET' });
  }
  if (cfg.NODE_ENV === 'production' && cfg.CORS_ORIGINS.split(',').includes('*')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['CORS_ORIGINS'], message: 'wildcard not allowed in production' });
  }
});

function buildSource() {
  if (process.env.NODE_ENV === 'test') {
    return {
      NODE_ENV: 'test',
      PORT: '0',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/saukele_test?schema=public',
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'test-access-secret-must-be-at-least-32-characters-long',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-must-be-at-least-32-characters-different',
      JWT_ACCESS_TTL: '15m',
      JWT_REFRESH_TTL: '7d',
      BCRYPT_ROUNDS: '4',
      CORS_ORIGINS: 'http://localhost:3000',
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_MAX: '1000',
      EXCHANGE_PROVIDER: 'mock',
    };
  }
  return process.env;
}

const result = schema.safeParse(buildSource());

if (!result.success) {
  const lines = result.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
  console.error('\n[env] Configuration invalid:\n' + lines.join('\n') + '\n');
  process.exit(1);
}

const env = Object.freeze({
  ...result.data,
  CORS_ORIGINS_LIST: result.data.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
});

module.exports = { env };