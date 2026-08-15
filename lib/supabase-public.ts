import { createClient } from '@supabase/supabase-js';

// Public client -- used on the customer-facing catalogue pages.
// Only ever reads data; RLS policies in schema.sql block writes from this key.
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
