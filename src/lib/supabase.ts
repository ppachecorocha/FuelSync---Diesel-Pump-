import { createClient } from "@supabase/supabase-js";

const _env = (import.meta as any).env as Record<string, unknown>;
const supabaseUrl = _env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = _env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables. Check your .env.local file.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
