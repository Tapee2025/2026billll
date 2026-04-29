# Invoice Overlay Printer

A web app that fills printed-invoice fields onto pre-printed A4 invoices at exact cm coordinates — replaces the typewriter workflow at Tapee Cement Industries.

- React (CRA) frontend
- **Browser-side PDF generation** via [jsPDF](https://github.com/parallax/jsPDF) (no backend needed in production)
- **Supabase** for storing field-position settings
- **Netlify** for hosting

## Local development (on Emergent)

The Emergent template still runs the FastAPI backend, but the app does not depend on it for PDF generation. Settings are loaded from Supabase. Just edit and the frontend hot-reloads.

### Required env vars (`/app/frontend/.env`)
```
REACT_APP_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
REACT_APP_SUPABASE_KEY=sb_publishable_xxx
```

## One-time Supabase setup

In your Supabase project → SQL Editor → run:

```sql
create table if not exists invoice_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  data jsonb not null,
  updated_at timestamptz default now()
);

alter table invoice_settings enable row level security;

create policy "anon read"   on invoice_settings for select using (true);
create policy "anon insert" on invoice_settings for insert with check (true);
create policy "anon update" on invoice_settings for update using (true);
```

## Deploying to Netlify (free)

1. Push this repo to GitHub (use Emergent's "Save to GitHub" button).
2. On https://netlify.com → **Add new site → Import from Git** → pick your repo.
3. Netlify auto-detects `netlify.toml` at the repo root. Build settings:
   - Base directory: `frontend`
   - Build command: `yarn install --frozen-lockfile && yarn build`
   - Publish directory: `frontend/build`
4. **Site settings → Environment variables** → add:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_KEY`
5. **Trigger deploy**. After ~2 min your app is live at `https://your-site.netlify.app`.
6. Every `git push` to `main` auto-redeploys.

## How printing works

1. Fill the form (PO No, Invoice No, Bill To, Bags, Price/Bag, …).
2. App computes MT, Rate per MT, GST, Grand Total, and amounts in words.
3. Click **Generate Print Preview** → a dialog shows the A4 PDF.
4. Click **Print** (or **Download PDF**).
5. Load your pre-printed invoice paper into the printer.
6. In your browser's Print dialog set **Scale = 100% / Actual Size** (NOT "Fit to page"), Margins = None.
7. The typed values land in the blank spaces of the pre-printed invoice.

## Calibration

If your printer still shifts/shrinks the print, open **Print Field Settings → Print Calibration**. Enter what you set vs. what actually printed for one reference field — the app will compensate every coordinate automatically.

---

**Tech stack**: React 19 · React Router · shadcn/ui · Tailwind · jsPDF · Supabase JS · Netlify
