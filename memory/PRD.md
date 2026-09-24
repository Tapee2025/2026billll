# Tapee Cement — GST Tax Invoice Generator (PRD)

## Original problem statement
Business owner needs to print invoices onto **blank paper that only carries the pre-printed company letterhead** at the top. The app must generate the **entire invoice layout** (borders, boxes, line-item table, GST tax totals, bank details, terms, QR, signature) below a blank letterhead band, replicating the company's reference bill. Data entry stays simple; the printout is a full, ready GST tax invoice.

Earlier iterations produced only a coordinate text-overlay for pre-printed stationery; this has now been **replaced** by full-page generation on blank letterhead paper.

## Architecture (current)
- 100% serverless **React SPA** (no backend server). Hosted on Netlify.
- **jsPDF** (unit: cm) draws the full A4 invoice in-browser.
- **qrcode** generates a live UPI payment QR (encodes the bill amount).
- **Supabase** (Postgres) stores editable company/bank/calc settings in table `invoice_settings`, single row `key='default'`, JSON in `data`.
- Env: `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_KEY`, `REACT_APP_BACKEND_URL` (preview only).

## Key files
- `src/lib/defaults.js` — fixed company constants, GST %, letterhead cm, backfill.
- `src/lib/pdf.js` — full-page invoice drawing (all coordinates in cm; top `letterhead_cm` left blank; every y shifts with letterhead height).
- `src/lib/settings.js` — Supabase fetch/save/reset.
- `src/pages/FillInvoicePage.jsx` — data entry form, auto-calc (bags→MT, GST), builds payload.
- `src/pages/SettingsPage.jsx` — edit company/bank/terms/GST%/letterhead.

## Business rules
- Cement HSN **25232930**, **GST 18% (9% CGST + 9% SGST)**.
- 1 MT = 20 bags (editable).
- Price/Bag entered is **inclusive of GST**; taxable, tax split, and grand total are derived.
- Amount-in-words: Bill Amount + Total GST (Indian numbering).
- Letterhead blank band default **4.0 cm** (editable).

## Implemented (2026-06)
- Full-page GST invoice matching the reference bill: title, GSTIN/PAN/MSME, place-of-supply/PO/invoice, Bill To/Ship To boxes, state/PAN/transport, line-item table (SrNo, Product Name, HSN, U.O.M, MT, No. of Bags, Rate Per MT, Cur, Amount), amount-in-words, driver/EWAY/valid-till, party code/region/destination, bank block, terms, totals block, live UPI QR, signature.
- Company/bank/terms/GST%/letterhead editable in Settings (Supabase).
- Verified via rendered PDF: sample matches reference (Taxable ₹12,288.14, Total GST ₹2,211.86, Grand Total ₹14,500.00).

## Backlog (P2)
- Customer address book / quick auto-fill.
- Multi-copy printing (Original / Duplicate / Triplicate labels).
- Optional toggle to also print the letterhead header (for digital/email PDF copies).
- Save/recall past invoices.
