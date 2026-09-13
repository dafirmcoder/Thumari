import { eq, and, gt } from 'drizzle-orm';
import type { FastifyReply } from 'fastify';
import type { Db } from '../db/index.js';
import { sessions, users, type User } from '../db/schema.js';
import { generateToken, hashToken, verifyPassword } from './password.js';

export const SESSION_COOKIE_NAME = 'thumari_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createSession(
  db: Db,
  userId: number,
  meta: { userAgent?: string; ip?: string } = {},
): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = generateToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({
    id: tokenHash,
    userId,
    userAgent: meta.userAgent,
    ip: meta.ip,
    expiresAt,
  });

  return { rawToken, expiresAt };
}

export async function resolveSession(db: Db, rawToken: string | undefined): Promise<User | null> {
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);

  const row = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, tokenHash), gt(sessions.expiresAt, new Date())))
    .get();

  if (!row || row.user.status !== 'active') return null;

  return row.user;
}

export async function destroySession(db: Db, rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await db.delete(sessions).where(eq(sessions.id, tokenHash));
}

export async function authenticateUser(db: Db, email: string, passwordPlain: string): Promise<User | null> {
  const user = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).get();
  if (!user || user.status !== 'active') return null;

  const valid = await verifyPassword(passwordPlain, user.passwordHash);
  if (!valid) return null;

  // Touch last login
  await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));

  return user;
}

export function setSessionCookie(reply: FastifyReply, rawToken: string, isProduction: boolean): void {
  reply.setCookie(SESSION_COOKIE_NAME, rawToken, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
}
