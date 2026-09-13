import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.js';
import type { Db } from '../db/index.js';
import { renderView } from '../web/views.js';

export function registerDownloadRoutes(app: FastifyInstance, db: Db, config: AppConfig) {
  app.get('/download', async (request, reply) => {
    return await renderView(
      request,
      reply,
      'download.ejs',
      {
        apkUrl: config.android.apkUrl,
        packageName: config.android.packageName,
      },
      config,
      db,
    );
  });
}
