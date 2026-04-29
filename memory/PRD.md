# Invoice Overlay Printer — PRD

## Original Problem Statement
User runs Tapee Cement Industries and currently uses a typewriter to fill blank fields on already-printed A4 invoice paper. They want a web app where:
1. They fill all fields in a digital form.
2. The app generates an A4 PDF that has ONLY the typed text positioned at exact cm coordinates.
3. They put their pre-printed invoice paper in the printer and print this overlay PDF on top.
4. A separate "Print Field Settings" page lets them adjust Top (cm) and Left (cm) for every field so they can fine-tune alignment.

## User Choices (gathered via ask_human)
- All visible invoice fields included with adjustable position settings
- Defaults pre-filled, fully editable & saveable
- Output: A4 PDF with text-only overlay (printed on pre-printed paper)
- No invoice saving / database history
- No login (open app)

## Architecture
- **Backend**: FastAPI + Motor (Mongo) + ReportLab for PDF generation
- **Frontend**: React 19 + React Router + shadcn/ui + sonner toasts + Tailwind
- **DB**: MongoDB single collection `invoice_settings` (one document, `key="default"`)

## Endpoints
- `GET  /api/settings` → returns saved settings or defaults
- `POST /api/settings` → upsert settings document
- `POST /api/settings/reset` → delete saved doc, returns defaults
- `POST /api/generate-pdf` → returns A4 PDF blob with text positioned per saved settings
- `GET  /api/defaults` → canonical defaults

## Default Field Positions (cm — from user)
| Field | Top | Left |
|---|---|---|
| P.O. No | 7.5 | 5.0 |
| P.O. Date | 7.9 | 5.0 |
| Invoice No | 7.0 | 14.2 |
| Invoice Date | 7.6 | 14.2 |
| PAN No (left) | 13.0 | 3.7 |
| PAN No (right) | 13.0 | 13.2 |
| Bill To box | 9.4 | 1.5  (W 8.0, H 2.6) |
| Ship To box | 9.4 | 11.1 (W 8.0, H 2.6) |

Other fields (Week No, Mode, Freight, Transporter, L.R., Vehicle, Driver, EWAY, TPCA, Region, Destination, Sub Total, Taxable, Central/State Tax, Total GST, Grand Total, Bill Amount) and line-item rows have reasonable defaults that the user can adjust on the Settings page.

## Implementation Status (Feb 2026)
- [x] Settings CRUD with MongoDB persistence
- [x] PDF generation using reportlab (Courier-Bold default — typewriter look)
- [x] Fill Invoice form: 5 grouped sections, Bill/Ship To with "Same as Bill To" checkbox, dynamic line-items table (add/remove rows)
- [x] Print Field Settings page: per-field Top/Left/Font Size/Bold + box width/height + line-items column lefts; Save / Reset buttons
- [x] All endpoints tested (7/7 pytest pass, frontend e2e validated)

## P1 Backlog (next)
- Live invoice preview (overlay text on a faded image of the blank invoice for screen verification before printing)
- Multiple template profiles (in case user has more than one printed format)
- Export/import settings as JSON
- Saved customer/Bill-To address book for auto-complete

## P2 Backlog
- Multi-user with login
- Save filled invoices in DB for reprint/search
- Bulk-fill via CSV upload
