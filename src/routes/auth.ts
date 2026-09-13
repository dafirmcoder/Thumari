import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import type { AppConfig } from '../config.js';
import { authenticateUser, createSession, destroySession, setSessionCookie, clearSessionCookie } from '../lib/auth.js';
import { renderView } from '../web/views.js';
import { setFlash } from '../lib/flash.js';

export function registerAuthRoutes(app: FastifyInstance, db: Db, config: AppConfig) {
  app.get('/login', async (request, reply) => {
    if (request.currentUser) {
      return reply.redirect('/dashboard');
    }
    const nextUrl = (request.query as any)?.next || '/dashboard';
    return await renderView(request, reply, 'auth/login.ejs', { nextUrl }, config, db);
  });

  app.post('/login', async (request, reply) => {
    const body = request.body as any;
    const email = body?.email || '';
    const password = body?.password || '';
    const nextUrl = body?.nextUrl || '/dashboard';

    const user = await authenticateUser(db, email, password);
    if (!user) {
      setFlash(reply, 'error', 'Invalid email or password.');
      return reply.redirect('/login');
    }

    const { rawToken } = await createSession(db, user.id, {
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });

    setSessionCookie(reply, rawToken, config.env === 'production');
    setFlash(reply, 'success', `Welcome back, ${user.name}!`);
    return reply.redirect(nextUrl.startsWith('/') ? nextUrl : '/dashboard');
  });

  app.post('/logout', async (request, reply) => {
    if (request.rawSessionToken) {
      await destroySession(db, request.rawSessionToken);
    }
    clearSessionCookie(reply);
    setFlash(reply, 'info', 'You have been signed out.');
    return reply.redirect('/login');
  });
}
