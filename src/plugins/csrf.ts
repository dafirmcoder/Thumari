import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';

export const CSRF_COOKIE_NAME = 'thumari_csrf';

declare module 'fastify' {
  interface FastifyRequest {
    csrfToken: string;
  }
}

export function registerCsrf(app: FastifyInstance): void {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    let token = request.cookies[CSRF_COOKIE_NAME];
    if (!token) {
      token = crypto.randomBytes(24).toString('hex');
      reply.setCookie(CSRF_COOKIE_NAME, token, {
        path: '/',
        httpOnly: false, // Accessible by PWA JavaScript client
        sameSite: 'lax',
      });
    }
    request.csrfToken = token;
  });

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const method = request.method.toUpperCase();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return;
    }

    // Skip CSRF for pure API push/webhook routes if authenticated via headers or sessions
    if (request.url.startsWith('/api/push/')) {
      return;
    }

    const body = request.body as Record<string, unknown> | undefined;
    const submittedToken =
      (body?._csrf as string) ||
      (request.headers['x-csrf-token'] as string);

    const expectedToken = request.cookies[CSRF_COOKIE_NAME];

    if (!expectedToken || !submittedToken || submittedToken !== expectedToken) {
      reply.status(403).send('Invalid or missing CSRF token.');
    }
  });
}
