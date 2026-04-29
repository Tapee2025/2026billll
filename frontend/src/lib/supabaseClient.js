import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "[Supabase] Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_KEY in .env"
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseKey || "");
export const SETTINGS_KEY = "default";
