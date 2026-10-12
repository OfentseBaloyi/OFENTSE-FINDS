import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Uses ONLY the publishable key, which is safe in browser code. All protection comes from
// Row Level Security policies in supabase/migrations. Never add a secret/service-role key here.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key && !key.startsWith("your_"));

let browserClient: SupabaseClient | null = null;

/** Browser client with persisted auth session (used by the admin area and uploads). */
export function getBrowserSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  browserClient ??= createClient(url!, key!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
  });
  return browserClient;
}

/** Stateless client for server-side public reads/inserts (anonymous role — RLS applies). */
export function createServerSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  return createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

/** PostgREST error codes meaning "the migrations haven't been run yet". */
export function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "PGRST205" || error.code === "42P01" || /schema cache|does not exist/i.test(error.message ?? "");
}
