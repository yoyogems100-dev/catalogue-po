import { createClient } from '@supabase/supabase-js';

// Admin client -- server-side only, never imported into a client component.
// Uses the service role key, which bypasses RLS, so it can read AND write.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export const PHOTOS_BUCKET = 'photos';
