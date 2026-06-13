import { createClient } from "@supabase/supabase-js";

const url = "https://goygizqyithyqzctiljk.supabase.co";
const key = "sb_publishable_Rr1uUzWlarLNSwweGSzg7Q_Dphdb5bC";

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "sb-auth" },
});