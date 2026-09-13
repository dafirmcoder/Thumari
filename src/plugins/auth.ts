import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../db/index.js';
import type { User, UserRole } from '../db/schema.js';
import { resolveSession, SESSION_COOKIE_NAME } from '../lib/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: User | null;
    rawSessionToken?: string;
  }
}

export function registerAuth(app: FastifyInstance, db: Db): void {
  app.addHook('onRequest', async (request: FastifyRequest) => {
    const rawCookie = request.cookies[SESSION_COOKIE_NAME];
    request.rawSessionToken = rawCookie;
    request.currentUser = await resolveSession(db, rawCookie);
  });
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.currentUser) {
    const nextUrl = encodeURIComponent(request.url);
    reply.redirect(`/login?next=${nextUrl}`);
  }
}

export function requireRole(roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.currentUser) {
      reply.redirect('/login');
      return;
    }
    if (!roles.includes(request.currentUser.role)) {
      reply.status(403).send('Forbidden: Insufficient privileges for this action');
    }
  };
}
