import { createClient } from '@supabase/supabase-js';
import { boundedFetch } from './bounded-fetch';

// Public client -- used on the customer-facing catalogue pages.
// Only ever reads data; RLS policies in schema.sql block writes from this key.
// Requests are capped, timed out and retried (lib/bounded-fetch.ts) so a busy
// build or one stalled connection can't hang every page that shares the load.
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { global: { fetch: boundedFetch({ maxConcurrent: 24, timeoutMs: 15000, retries: 1 }) } }
);
