import { createServerClient } from '@supabase/ssr';
import type { FastifyRequest } from 'fastify';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

export function createSupabaseServerClient(request: FastifyRequest, setCookie: (name: string, value: string, options: Record<string, unknown>) => void) {
  if (!supabaseUrl || !supabaseKey) return null;

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return Object.entries(request.cookies)
          .filter((entry): entry is [string, string] => entry[1] !== undefined)
          .map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => setCookie(name, value, options));
      },
    },
  });
}