import path from 'node:path';
import { z } from 'zod';
import { DATA_DIR } from './paths.js';

// Try loading .env if it exists
try {
  process.loadEnvFile?.();
} catch {
  // .env is optional
}

const defaultDb =
  process.env.DATABASE_URL ||
  (process.env.VERCEL ? '/tmp/thumari.sqlite3' : path.join(DATA_DIR, 'thumari.sqlite3'));

const configSchema = z.object({
  env: z.enum(['development', 'test', 'production']).default('development'),
  port: z.coerce.number().int().default(3000),
  host: z.string().default('0.0.0.0'),
  publicBaseUrl: z.string().default('http://localhost:3000'),
  databaseFile: z.string().default(defaultDb),
  databaseAuthToken: z.string().optional(),
  sessionSecret: z.string().min(16).default('development-session-secret-must-be-changed-in-production-12345'),
  org: z.object({
    name: z.string().default("Thumari Men's Association"),
    tagline: z.string().default('Kirinyaga County • Unity. Farming. Fellowship.'),
    currency: z.string().default('KES'),
    currencySymbol: z.string().default('KES'),
    timezone: z.string().default('Africa/Nairobi'),
    locale: z.string().default('en-KE'),
  }),
  vapid: z.object({
    publicKey: z.string().optional().default(''),
    privateKey: z.string().optional().default(''),
    subject: z.string().default('mailto:admin@thumari.local'),
  }),
  android: z.object({
    packageName: z.string().default('app.thumari.twa'),
    certFingerprints: z.array(z.string()).default([]),
    apkUrl: z.string().default('/static/downloads/thumari.apk'),
  }),
  supabase: z.object({
    url: z.string().optional().default(''),
    anonKey: z.string().optional().default(''),
    serviceRoleKey: z.string().optional().default(''),
    storageBucket: z.string().default('thumari-uploads'),
  }).optional(),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(envOverrides?: Record<string, string | undefined>): AppConfig {
  const env = envOverrides ?? process.env;

  const fingerprintsRaw = env.ANDROID_CERT_FINGERPRINTS ?? '';
  const certFingerprints = fingerprintsRaw
    ? fingerprintsRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return configSchema.parse({
    env: env.NODE_ENV,
    port: env.PORT,
    host: env.HOST,
    publicBaseUrl: env.PUBLIC_BASE_URL,
    databaseFile: env.DATABASE_URL || env.DATABASE_FILE || defaultDb,
    databaseAuthToken: env.DATABASE_AUTH_TOKEN || env.TURSO_AUTH_TOKEN,
    sessionSecret: env.SESSION_SECRET,
    org: {
      name: env.ORG_NAME,
      tagline: env.ORG_TAGLINE,
      currency: env.CURRENCY,
      currencySymbol: env.CURRENCY_SYMBOL,
      timezone: env.DEFAULT_TIMEZONE,
      locale: env.LOCALE,
    },
    vapid: {
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      subject: env.VAPID_SUBJECT,
    },
    android: {
      packageName: env.ANDROID_PACKAGE_NAME,
      certFingerprints,
      apkUrl: env.ANDROID_APK_URL,
    },
    supabase: {
      url: env.SUPABASE_URL || '',
      anonKey: env.SUPABASE_ANON_KEY || '',
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
      storageBucket: env.SUPABASE_STORAGE_BUCKET || 'thumari-uploads',
    },
  });
}

export const config = loadConfig();
