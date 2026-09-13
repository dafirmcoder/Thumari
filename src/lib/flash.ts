import type { FastifyReply, FastifyRequest } from 'fastify';

export const FLASH_COOKIE_NAME = 'thumari_flash';

export interface FlashMessage {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export function setFlash(reply: FastifyReply, type: FlashMessage['type'], message: string): void {
  const payload = JSON.stringify({ type, message });
  reply.setCookie(FLASH_COOKIE_NAME, Buffer.from(payload).toString('base64url'), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60, // 1 minute
  });
}

export function readAndClearFlash(request: FastifyRequest, reply: FastifyReply): FlashMessage | null {
  const raw = request.cookies[FLASH_COOKIE_NAME];
  if (!raw) return null;

  reply.clearCookie(FLASH_COOKIE_NAME, { path: '/' });

  try {
    const jsonStr = Buffer.from(raw, 'base64url').toString('utf-8');
    return JSON.parse(jsonStr) as FlashMessage;
  } catch {
    return null;
  }
}
