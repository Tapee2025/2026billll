// Default configuration for the full-page GST tax invoice generator.
// The app prints the ENTIRE invoice layout on blank paper that only carries
// the pre-printed company letterhead at the top. The top band (letterhead_cm)
// is left blank so it lands under the printed letterhead.

// Fixed company / bank constants (from the user's reference invoice).
// Editable on the Settings page and stored in Supabase.
export const DEFAULT_COMPANY = {
  name: "TAPEE CEMENT INDUSTRIES",
  gstin: "24AACFT8766G1ZW",
  pan: "AACFT8766G",
  msme: "UDYAM-GJ-20-0030085",
  place_of_supply: "24-Gujarat",
  state_code: "24",
  hsn: "25232930",
  bank_name: "KARUR VYSYA BANK",
  account_no: "2135229000000550",
  ifsc: "KVBL0002135",
  branch: "NEO MUMBAI",
  account_type: "CURRENT",
  upi_id: "kvbupiqr.105000000014364@kvb",
  terms: [
    "Goods once sold will not be taken back.",
    "Interest @18% p.a. will be charged if payment is not made within due date.",
    "Our risk and responsibility ceases as soon as the goods leave our premises.",
    "Subject to 'RAJKOT' Jurisdiction only. E.&.O.E",
  ],
};

export const DEFAULT_CALCULATION = {
  bags_per_mt: 20,
  gst_percent: 18.0, // cement → 18% (9% CGST + 9% SGST)
  max_rows: 8,
};

export const DEFAULT_SETTINGS = {
  company: DEFAULT_COMPANY,
  calculation: DEFAULT_CALCULATION,
  letterhead_cm: 4.0, // blank top band for the pre-printed letterhead
};

// Merge a previously-saved settings doc onto the current defaults so newer
// keys are always present (and legacy overlay/calibration docs are ignored).
export function backfillSettings(doc) {
  if (!doc) return DEFAULT_SETTINGS;
  return {
    company: { ...DEFAULT_COMPANY, ...(doc.company || {}) },
    calculation: { ...DEFAULT_CALCULATION, ...(doc.calculation || {}) },
    letterhead_cm:
      typeof doc.letterhead_cm === "number" ? doc.letterhead_cm : 4.0,
  };
}
