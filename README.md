# SCMv2 (independent — Supabase backend)

Migrated off Base44. Frontend is React + Vite; all backend (database, auth,
storage) runs on Supabase. App logic is unchanged — the old `base44.*` import
surface is preserved as a compatibility shim over Supabase
(`src/api/base44Client.js`).

## Prerequisites

1. Node.js 18+ and npm.
2. A Supabase project (URL + anon key).
3. Supabase CLI (optional, for migrations): `npm i -g supabase`.

## Setup

1. Install dependencies: `npm install`.
2. Copy env template: `cp .env.example .env.local`, then fill in:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - (optional) `VITE_ACCURATE_CLIENT_ID` / `VITE_ACCURATE_CLIENT_SECRET` for the Accurate settings page.
3. Apply the database schema (creates all 23 entity tables + `profiles`, RLS policies, `uploads` storage bucket):
   - `supabase link --project-ref <your-project-ref>`, then `supabase db push`,
   - or paste `supabase/migrations/0001_base44_migration.sql` into Dashboard > SQL Editor and run it.
4. In Supabase Dashboard > Authentication, enable Email provider (and email confirmations if you want OTP verification on register).

## Run locally

```bash
npm run dev
```

Open the local URL printed by Vite.

## Build

```bash
npm run build
```

## Deploy

Any static host works (Vercel, Netlify, etc.): build command `npm run build`, output `dist`. Set the same `VITE_*` env vars in the host dashboard.

## PLGen auto-sync (optional)

When set, visiting Pengiriman auto-creates Shipments from new PLGen exports
(read-only on PLGen's project — nothing in PLGen is modified):

- `VITE_PLGEN_SUPABASE_URL`, `VITE_PLGEN_SUPABASE_ANON_KEY`
- Dedup by `do_number` (= PLGen `delivery_no`); outlet auto-created in master.
- Delivery date = export date (WIB) + 1 working day (Sundays skipped).
- Origin warehouse defaults live in `WAREHOUSE_BY_COMPANY` in
  `src/api/functions/plgenSync.js` (`BBT → Gudang Batu Ceper`,
  `BBB → Batu Ceper`).

## Project map

- `src/api/supabaseClient.js` — Supabase client.
- `src/api/db.js` — Base44-compatible entity layer over Supabase tables.
- `src/api/authCompat.js` — Base44-compatible auth over Supabase Auth + `profiles`.
- `src/api/functions/` — local replacements for Base44 backend functions (`manageUsers`, `accurateApi`, `parsePdfReport`).
- `src/api/storageCompat.js` — file uploads via Supabase Storage (`uploads` bucket).
- `src/api/base44Client.js` — compatibility export; existing pages import this unchanged.
- `supabase/migrations/` — SQL schema.
- `supabase/functions/accurate-proxy/` — optional CORS relay for Accurate API.
- `base44/` — legacy reference only (schemas + original functions, kept for history).
