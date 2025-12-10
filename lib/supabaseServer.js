// lib/supabaseServer.js
import { createClient } from "@supabase/supabase-js";

export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  // If you later add SERVICE_ROLE, you can switch to that *only* on server
);
