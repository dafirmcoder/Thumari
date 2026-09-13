import type { FastifyInstance } from 'fastify';
import { createSupabaseServerClient } from './server.js';

export function registerSupabaseSessionRefresh(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    const supabase = createSupabaseServerClient(request, (name, value, options) => {
      reply.setCookie(name, value, options);
    });

    if (supabase) {
      await supabase.auth.getUser();
    }
  });
}