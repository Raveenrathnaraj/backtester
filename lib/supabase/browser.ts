import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client using the anon/publishable key.
 * Used ONLY for auth operations (login, signup, OAuth) in client components.
 * Data queries should go through API routes using the service client.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
