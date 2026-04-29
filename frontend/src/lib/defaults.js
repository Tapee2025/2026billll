// Default print field positions (cm) — moved from FastAPI backend so the app
// can run entirely in the browser without a backend server.
// All measurements are top/left from the top-left corner of A4 paper.

export const DEFAULT_SINGLE_FIELDS = {
  po_no:           { label: "P.O. No",            top: 7.5,  left: 5.0,  font_size: 11, bold: true },
  po_date:         { label: "P.O. Date",          top: 7.9,  left: 5.0,  font_size: 11, bold: true },
  invoice_no:      { label: "Invoice No",         top: 7.0,  left: 14.2, font_size: 11, bold: true },
  invoice_date:    { label: "Invoice Date",       top: 7.6,  left: 14.2, font_size: 11, bold: true },
  pan_no_left:     { label: "PAN No (Bill To)",   top: 13.0, left: 3.7,  font_size: 11, bold: true },
  pan_no_right:    { label: "PAN No (Ship To)",   top: 13.0, left: 13.2, font_size: 11, bold: true },
  week_no:         { label: "Week No",            top: 14.0, left: 4.5,  font_size: 11, bold: true },
  mode_of_transport: { label: "Mode of Transport", top: 14.5, left: 4.5, font_size: 11, bold: true },
  freight:         { label: "Freight",            top: 15.0, left: 4.5,  font_size: 11, bold: true },
  transporter_name:{ label: "Transporter Name",   top: 14.0, left: 14.5, font_size: 11, bold: true },
  lr_no:           { label: "L.R. No",            top: 14.5, left: 14.5, font_size: 11, bold: true },
  vehicle_no:      { label: "Vehicle No",         top: 15.0, left: 14.5, font_size: 11, bold: true },
  driver_mobile:   { label: "Driver Mobile",      top: 21.5, left: 4.0,  font_size: 11, bold: true },
  eway_bill_no:    { label: "EWAY Bill No",       top: 22.0, left: 4.0,  font_size: 11, bold: true },
  tpca_code:       { label: "TPCA Code",          top: 21.5, left: 9.5,  font_size: 11, bold: true },
  region:          { label: "Region",             top: 22.0, left: 9.5,  font_size: 11, bold: true },
  destination:     { label: "Destination",        top: 22.5, left: 9.5,  font_size: 11, bold: true },
  taxable_amount:  { label: "Taxable Amount",     top: 21.5, left: 17.5, font_size: 11, bold: true },
  central_tax:     { label: "Central Tax Amt",    top: 22.0, left: 17.5, font_size: 11, bold: true },
  state_tax:       { label: "State/UT Tax Amt",   top: 22.5, left: 17.5, font_size: 11, bold: true },
  sub_total:       { label: "Sub Total",          top: 21.0, left: 17.5, font_size: 11, bold: true },
  grand_total:     { label: "Grand Total",        top: 23.0, left: 17.5, font_size: 11, bold: true },
  total_gst:       { label: "Total GST",          top: 24.0, left: 4.0,  font_size: 11, bold: true },
  bill_amount:     { label: "Bill Amount",        top: 24.5, left: 4.0,  font_size: 11, bold: true },
};

export const DEFAULT_BOX_FIELDS = {
  bill_to: { label: "Details of Bill To", top: 9.4, left: 1.5,  width: 8.0, height: 2.6, font_size: 11, bold: true, line_height: 0.5 },
  ship_to: { label: "Details of Ship To", top: 9.4, left: 11.1, width: 8.0, height: 2.6, font_size: 11, bold: true, line_height: 0.5 },
};

export const DEFAULT_LINE_ITEMS = {
  label: "Line Items (per row)",
  first_row_top: 18.4,
  row_height: 0.55,
  max_rows: 8,
  font_size: 11,
  bold: true,
  columns: {
    product:     { label: "Product Name", left: 2.5,  top_offset: -0.7 },
    mt:          { label: "MT",           left: 8.7,  top_offset: 0.0 },
    no_of_bags:  { label: "No. of Bags",  left: 10.5, top_offset: 0.0 },
    rate_per_mt: { label: "Rate Per MT",  left: 12.7, top_offset: 0.0 },
    amount:      { label: "Amount",       left: 16.7, top_offset: 0.0 },
  },
};

export const DEFAULT_CALCULATION = {
  bags_per_mt: 20,
  gst_percent: 18.0,
};

export const DEFAULT_CALIBRATION = {
  vertical_set: 1.0,
  vertical_actual: 1.0,
  horizontal_set: 1.0,
  horizontal_actual: 1.0,
  vertical_offset: 0.0,
  horizontal_offset: 0.0,
};

export const DEFAULT_SETTINGS = {
  single_fields: DEFAULT_SINGLE_FIELDS,
  box_fields: DEFAULT_BOX_FIELDS,
  line_items: DEFAULT_LINE_ITEMS,
  calculation: DEFAULT_CALCULATION,
  calibration: DEFAULT_CALIBRATION,
};

// Backfill any newer keys missing from a previously-saved settings doc.
export function backfillSettings(doc) {
  if (!doc) return DEFAULT_SETTINGS;
  const out = { ...doc };
  if (!out.calculation) out.calculation = DEFAULT_CALCULATION;
  if (!out.calibration) out.calibration = DEFAULT_CALIBRATION;
  if (!out.line_items) out.line_items = DEFAULT_LINE_ITEMS;
  const cols = out.line_items.columns || {};
  if (!cols.product) cols.product = DEFAULT_LINE_ITEMS.columns.product;
  Object.values(cols).forEach((c) => {
    if (c.top_offset === undefined) c.top_offset = 0.0;
  });
  out.line_items.columns = cols;
  return out;
}
