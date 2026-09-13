import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import type { AppConfig } from '../config.js';
import { requireAuth } from '../plugins/auth.js';
import { getDashboardSummary } from '../services/reports.js';
import { listContributions } from '../services/contributions.js';
import { listLoans } from '../services/loans.js';
import { renderView } from '../web/views.js';

export function registerDashboardRoutes(app: FastifyInstance, db: Db, config: AppConfig) {
  app.get('/', async (request, reply) => {
    if (request.currentUser) {
      return reply.redirect('/dashboard');
    }
    return reply.redirect('/login');
  });

  app.get('/dashboard', { preHandler: requireAuth }, async (request, reply) => {
    const summary = await getDashboardSummary(db, config.org.timezone);
    const recentContributions = await listContributions(db, { limit: 5 });
    const recentLoans = await listLoans(db);

    return await renderView(
      request,
      reply,
      'dashboard.ejs',
      {
        summary,
        recentContributions,
        recentLoans: recentLoans.slice(0, 5),
      },
      config,
      db,
    );
  });
}
