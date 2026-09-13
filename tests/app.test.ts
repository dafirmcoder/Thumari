import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDatabase, applyMigrations } from '../src/db/index.js';

describe('App HTTP & PWA endpoints', () => {
  let appInstance: any;

  beforeAll(async () => {
    const dbHandle = createDatabase(':memory:');
    await applyMigrations(dbHandle.db);
    const { app } = await buildApp({
      dbHandle,
      configOverrides: {
        NODE_ENV: 'test',
        PUBLIC_BASE_URL: 'http://localhost:3000',
      },
    });
    appInstance = app;
  });

  it('serves dynamic PWA webmanifest with valid icons and scope', async () => {
    const res = await appInstance.inject({
      method: 'GET',
      url: '/manifest.webmanifest',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/manifest+json');
    const json = JSON.parse(res.payload);
    expect(json.name).toBe("Thumari Men's Association");
    expect(json.display).toBe('standalone');
    expect(json.icons.length).toBeGreaterThanOrEqual(3);
  });

  it('serves service worker with Service-Worker-Allowed header', async () => {
    const res = await appInstance.inject({
      method: 'GET',
      url: '/sw.js',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['service-worker-allowed']).toBe('/');
    expect(res.payload).toContain('CACHE_NAME');
  });

  it('serves .well-known/assetlinks.json for Android TWA verification', async () => {
    const res = await appInstance.inject({
      method: 'GET',
      url: '/.well-known/assetlinks.json',
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(Array.isArray(json)).toBe(true);
    expect(json[0].target.package_name).toBe('app.thumari.twa');
  });

  it('serves the APK download portal', async () => {
    const res = await appInstance.inject({
      method: 'GET',
      url: '/download',
    });

    expect(res.statusCode).toBe(200);
    expect(res.payload).toContain('Download Android APK');
  });

  it('serves the favicon correctly', async () => {
    const res = await appInstance.inject({
      method: 'GET',
      url: '/favicon.ico',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
  });

  it('redirects unauthenticated users from reports and coffee produce to login', async () => {
    const resMonthly = await appInstance.inject({
      method: 'GET',
      url: '/reports/contributions-monthly',
    });
    expect(resMonthly.statusCode).toBe(302);
    expect(resMonthly.headers.location).toContain('/login');

    const resCoffee = await appInstance.inject({
      method: 'GET',
      url: '/coffee',
    });
    expect(resCoffee.statusCode).toBe(302);
    expect(resCoffee.headers.location).toContain('/login');
  });

  it('redirects unauthenticated users on coffee produce report', async () => {
    const res = await appInstance.inject({
      method: 'GET',
      url: '/reports/coffee-produce?year=2026',
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('/login');
  });
});
