import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppConfig } from '../config.js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(config: AppConfig): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const url = config.supabase?.url || process.env.SUPABASE_URL;
  const key = config.supabase?.serviceRoleKey || config.supabase?.anonKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  supabaseClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseClient;
}

export async function uploadToSupabaseStorage(
  config: AppConfig,
  bucket: string,
  path: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string | null> {
  const client = getSupabaseClient(config);
  if (!client) return null;

  try {
    const { error } = await client.storage
      .from(bucket)
      .upload(path, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.warn('Supabase storage upload error:', error.message);
      return null;
    }

    const { data } = client.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.warn('Failed to upload file to Supabase Storage:', err);
    return null;
  }
}
