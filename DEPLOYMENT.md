# Step-by-step: GitHub → Netlify → Supabase

This file is a complete deployment runbook for the Invoice Overlay Printer.

## 1. Run the Supabase setup SQL (one time)

Open https://supabase.com/dashboard → your project → SQL Editor → New query → paste:

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

Click **RUN**. You should see "Success. No rows returned".

## 2. Push to GitHub from Emergent

In your Emergent workspace, top-right corner → **Save to GitHub** → pick a new or existing repo → confirm. The push includes:
- `frontend/` — the React app
- `backend/` — the original FastAPI code (no longer used in production but kept for reference / local dev)
- `netlify.toml` — Netlify build config

## 3. Connect the repo to Netlify

1. Go to https://app.netlify.com → **Add new site → Import an existing project**.
2. Pick **GitHub** → authorize → choose your repo.
3. Netlify reads `netlify.toml` automatically. Build settings should look like:
   - Base directory: `frontend`
   - Build command: `yarn install --frozen-lockfile && yarn build`
   - Publish directory: `build` (relative to base, so the actual path is `frontend/build`)
4. **Click "Show advanced" → Environment variables → Add**:
   ```
   REACT_APP_SUPABASE_URL = https://cosibzjflmvaekqbzmnx.supabase.co
   REACT_APP_SUPABASE_KEY = sb_publishable_R_8Mm44HaR0ZDHAFni5Iiw_zoxPTklK
   ```
5. Click **Deploy**. Wait ~2 minutes. Done!

Your app is live at `https://<site-name>.netlify.app`. Bookmark it. Use it daily.

## 4. Every change after that

```
# in your local clone of the repo
git pull
# edit files
git add .
git commit -m "your change"
git push
```

Netlify auto-builds and redeploys on every push to `main` — usually live within 2 minutes.

## 5. Custom domain (optional, free)

In Netlify → Site → **Domain settings** → **Add custom domain**. Free Netlify subdomains stay forever; bringing your own domain just needs a CNAME record at your registrar.

---

## Costs

- **GitHub**: free (unlimited public + private repos).
- **Netlify**: free tier — 100 GB bandwidth/month, 300 build min/month. Far more than this app needs.
- **Supabase**: free tier — 500 MB DB, 1 GB file storage, 50 K monthly active users. This app uses ~1 KB.

**Total monthly cost: ₹0** for normal daily use.
