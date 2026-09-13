import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from '../src/app.js';
import { applyMigrations } from '../src/db/index.js';

let appPromise: Promise<any> | null = null;

async function getFastifyApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const { app, handle } = await buildApp();
      try {
        await applyMigrations(handle.db);
      } catch (migrationErr) {
        console.warn('Database migration warning in serverless environment:', migrationErr);
      }
      await app.ready();
      return app;
    })();
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getFastifyApp();
    app.server.emit('request', req, res);
  } catch (err: any) {
    console.error('Vercel Serverless Invocation Error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<h1>500 - Serverless Function Error</h1><p>${err?.message || 'Function invocation failed'}</p>`);
    }
  }
}
