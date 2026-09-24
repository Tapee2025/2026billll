# Tapee Cement — GST Tax Invoice Generator (PRD)

## Original problem statement
Business owner needs to produce GST tax invoices for Tapee Cement Industries. After iterating,
the FINAL approach (user's explicit choice): the user supplies their **exact official invoice
PDF template** (letterhead + all boxes/labels + constant values already printed). The app must
**only fill the blank/variable fields** by overlaying text at precise coordinates, so every
printout is a pixel-perfect match of the reference bill. Print on plain A4 at 100%.

## Architecture (100% serverless frontend)
- React SPA. No backend server.
- PDF: **pdf-lib** loads `public/template/tax_invoice_template.pdf` and overlays text into blank fields.
- QR / letterhead / product / bank / tax% / terms are BAKED into the template (not drawn by us).
- Settings persisted to **Supabase** table `invoice_settings` (single row key='default').
- Calc constants: bags_per_mt = 20, gst_percent = 18 (cement, 9% CGST + 9% SGST).

## Key files
- `src/lib/pdf.js` — `generatePdfBlob(settings, data)`: async; fetches the template PDF, draws only
  variable fields with pdf-lib at hardcoded coordinates (baseline-from-top; y = 841.5 - yt).
- `src/lib/numberToWords.js` — `amountWords()` (reference style, no "Rupees" prefix), `fmt()` Indian grouping.
- `src/pages/FillInvoicePage.jsx` — form trimmed to variable fields only; auto totals; preview/print/download.
- `src/pages/SettingsPage.jsx` — company/calc settings (company fields now largely informational since
  they are baked into the template; GST% & bags/MT still drive calculations).
- `public/template/tax_invoice_template.pdf` — the user's exact official template (source of truth).

## Blank fields overlaid (variable per invoice)
Invoice No, Invoice Date, P.O. Date, Bill To, Ship To, PAN(Bill), PAN(Ship), Week No, Vehicle No,
EWAY Bill No, EWAY Valid Till, Region, Destination, line-item numbers (MT, No. Of Bags, Rate Per MT,
Amount), Sub Total, Taxable Amount, Central Tax amt, State/UT Tax amt, Grand Total, TOTAL GST (words),
BILL AMOUNT (words).

## Baked in template (constant — change by editing the template PDF, not the app)
Letterhead, GSTIN 24AACFT8766G1ZW, PAN AACFT8766G, MSME, Place of Supply 24-Gujarat, State Code 24,
P.O. No SELF, Mode of Transport ROAD, Freight TO PAY, Transporter SELF, L.R. No NA, Driver Mobile NA,
Party Code NA, Product P.P.C. PREMIUM CEMENT + HSN 25232930, UOM MT, Currency ₹, bank details, UPI QR,
tax % 9.00%, Terms & Condition, signature/seal.

## Status — DONE & verified (Jun 2026)
- Template-overlay generation: implemented and testing_agent verified 100% (iteration_5.json).
  All overlaid values + baked constants present; totals exact (Taxable 12,288.14 / CGST+SGST 1,105.93
  each / Grand 14,500.00); words correct; download & open-in-new-tab work; single A4 page.

## Backlog / future (P2)
- Rupee ₹ glyph is baked in template (fine). If we ever redraw, embed a Unicode font.
- Multi-product invoices: template bakes a single product row; extra rows overlay product+UOM (rare).
- Trim SettingsPage to only calculation settings + a note that design comes from the template.
- Saved invoices history (search & reprint); customer address book auto-fill.
- Guard amountWords() paise rounding edge case (0.995 -> 100 paise).

## Deploy
- Static Netlify build (see DEPLOYMENT.md / netlify.toml). Supabase keys in frontend/.env.
