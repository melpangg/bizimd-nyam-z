import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseUrl = url || "";
export const supabasePublishableKey = key || "";

export const supabase = createClient(
  url || "https://example.supabase.co",
  key || "missing-publishable-key"
);

export const isSupabaseConfigured = Boolean(url && key);