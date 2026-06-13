import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SB_URL as string;
const key = import.meta.env.VITE_SB_KEY as string;

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "sb-auth" },
});