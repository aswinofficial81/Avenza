import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@avenza/shared';
import { env } from '../config/env';

let supabaseInstance: SupabaseClient<Database> | null = null;

export function getSupabaseAdminClient(): SupabaseClient<Database> {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = env.SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-placeholder';

  supabaseInstance = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseInstance;
}
