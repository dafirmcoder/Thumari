import path from 'node:path';
import { z } from 'zod';
import { DATA_DIR } from './paths.js';

// Try loading .env if it exists
try {
  process.loadEnvFile?.();
} catch {
  // .env is optional
}

const configSchema = z.object({
  env: z.enum(['development', 'test', 'production']).default('development'),
  port: z.coerce.number().int().default(3000),
  host: z.string().default('0.0.0.0'),
  publicBaseUrl: z.string().default('http://localhost:3000'),
  databaseFile: z.string().default(path.join(DATA_DIR, 'thumari.sqlite3')),
  sessionSecret: z.string().min(16).default('development-session-secret-must-be-changed-in-production-12345'),
  org: z.object({
    name: z.string().default('Thumari SACCO'),
    tagline: z.string().default('Empowering Community Savings and Investments'),
    currency: z.string().default('TZS'),
    currencySymbol: z.string().default('TSh'),
    timezone: z.string().default('Africa/Dar_es_Salaam'),
    locale: z.string().default('en-GB'),
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
    databaseFile: env.DATABASE_FILE,
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
  });
}

export const config = loadConfig();
