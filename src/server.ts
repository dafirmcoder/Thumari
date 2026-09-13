import { buildApp } from './app.js';
import { applyMigrations } from './db/index.js';

async function start() {
  try {
    const { app, handle, config } = await buildApp();

    console.log('Ensuring database migrations are up to date...');
    await applyMigrations(handle.db);

    await app.listen({
      port: config.port,
      host: config.host,
    });

    console.log(`\n======================================================`);
    console.log(`🚀 ${config.org.name} Server running!`);
    console.log(`📡 Local URL:    http://localhost:${config.port}`);
    console.log(`📲 PWA Manifest: http://localhost:${config.port}/manifest.webmanifest`);
    console.log(`📲 ServiceWorker:http://localhost:${config.port}/sw.js`);
    console.log(`📥 Download APK: http://localhost:${config.port}/download`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  }
}

start();
