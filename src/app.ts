import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyFormbody from '@fastify/formbody';
import fastifyHelmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import fastifyView from '@fastify/view';
import ejs from 'ejs';
import path from 'node:path';
import { type AppConfig, loadConfig } from './config.js';
import { createDatabase, type DatabaseHandle } from './db/index.js';
import { NotificationQueue } from './services/notifications/queue.js';
import { configureWebPush } from './services/notifications/sender.js';
import { registerAuth } from './plugins/auth.js';
import { registerCsrf } from './plugins/csrf.js';
import { VIEWS_DIR, PUBLIC_DIR } from './paths.js';

// Import Routes
import { registerAuthRoutes } from './routes/auth.js';
import { registerDashboardRoutes } from './routes/dashboard.js';
import { registerMemberRoutes } from './routes/members.js';
import { registerContributionRoutes } from './routes/contributions.js';
import { registerLoanRoutes } from './routes/loans.js';
import { registerMeetingRoutes } from './routes/meetings.js';
import { registerNotificationRoutes } from './routes/notifications.js';
import { registerReportRoutes } from './routes/reports.js';
import { registerDownloadRoutes } from './routes/download.js';
import { registerPwaRoutes } from './routes/pwa.js';

export interface BuildAppOptions {
  configOverrides?: Record<string, string | undefined>;
  dbHandle?: DatabaseHandle;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<{
  app: FastifyInstance;
  handle: DatabaseHandle;
  queue: NotificationQueue;
  config: AppConfig;
}> {
  const config = loadConfig(options.configOverrides);
  const handle = options.dbHandle ?? createDatabase(config.databaseFile);
  const queue = new NotificationQueue(handle.db);

  configureWebPush(config);

  const app = Fastify({
    logger: config.env === 'development',
  });

  // Security headers with CSP tailored for PWA & Service Workers
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        manifestSrc: ["'self'"],
        workerSrc: ["'self'"],
      },
    },
  });

  await app.register(fastifyCookie, {
    secret: config.sessionSecret,
  });

  await app.register(fastifyFormbody);

  // Serve static files from /static/
  await app.register(fastifyStatic, {
    root: PUBLIC_DIR,
    prefix: '/static/',
    decorateReply: false,
  });

  // View Engine (EJS)
  await app.register(fastifyView, {
    engine: { ejs },
    root: VIEWS_DIR,
  });

  // Custom Plugins
  registerAuth(app, handle.db);
  registerCsrf(app);

  // Register Routes
  registerPwaRoutes(app, config);
  registerDownloadRoutes(app, handle.db, config);
  registerAuthRoutes(app, handle.db, config);
  registerDashboardRoutes(app, handle.db, config);
  registerMemberRoutes(app, handle.db, config);
  registerContributionRoutes(app, handle.db, config, queue);
  registerLoanRoutes(app, handle.db, config, queue);
  registerMeetingRoutes(app, handle.db, config, queue);
  registerNotificationRoutes(app, handle.db, config, queue);
  registerReportRoutes(app, handle.db, config);

  return { app, handle, queue, config };
}
