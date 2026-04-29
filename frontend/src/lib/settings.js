import { supabase, SETTINGS_KEY } from "./supabaseClient";
import { DEFAULT_SETTINGS, backfillSettings } from "./defaults";

const TABLE = "invoice_settings";

export async function fetchSettings() {
  const { data, error } = await supabase
    .from(TABLE)
    .select("data")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    // eslint-disable-next-line no-console
    console.error("Supabase fetchSettings error:", error);
  }
  if (!data) return DEFAULT_SETTINGS;
  return backfillSettings(data.data);
}

export async function saveSettings(settings) {
  const payload = {
    single_fields: settings.single_fields,
    box_fields: settings.box_fields,
    line_items: settings.line_items,
    calculation: settings.calculation,
    calibration: settings.calibration,
  };
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      {
        key: SETTINGS_KEY,
        data: payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
  if (error) {
    // eslint-disable-next-line no-console
    console.error("Supabase saveSettings error:", error);
    throw error;
  }
  return { status: "ok" };
}

export async function resetSettings() {
  const { error } = await supabase.from(TABLE).delete().eq("key", SETTINGS_KEY);
  if (error) {
    // eslint-disable-next-line no-console
    console.error("Supabase resetSettings error:", error);
  }
  return DEFAULT_SETTINGS;
}
