import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import type { AppConfig } from '../config.js';
import { requireAuth, requireRole } from '../plugins/auth.js';
import { getSavingsReportByProduct } from '../services/reports.js';
import { renderView } from '../web/views.js';

export function registerReportRoutes(app: FastifyInstance, db: Db, config: AppConfig) {
  app.get('/reports', { preHandler: [requireAuth, requireRole(['admin', 'treasurer'])] }, async (request, reply) => {
    const savingsByProduct = await getSavingsReportByProduct(db);
    return await renderView(request, reply, 'reports/index.ejs', { savingsByProduct }, config, db);
  });
}
