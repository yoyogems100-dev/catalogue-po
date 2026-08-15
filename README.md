# YOYO GEMS — Digital Catalogue

Wholesale gemstone catalogue and admin panel for YOYO GEMS (Jaipur, India | China).

**Live site:** https://yoyo-gems-catalogue.vercel.app
**Admin panel:** https://yoyo-gems-catalogue.vercel.app/admin

## Stack
- Next.js 14 (App Router)
- Supabase (Postgres + Storage)
- Vercel (hosting)
- Plain CSS (no Tailwind) — see `app/globals.css`, brand tokens as CSS variables

## Infrastructure IDs
- **Vercel team:** Yoyo Catalogue — `team_3349X17CLxvHlvuewqzx2rf3`
- **Vercel project:** yoyo-gems-catalogue — `prj_RwOIxPeAXym4tUQqAkIpwyFX7PYy`
- **Supabase project:** yoyo-gems-catalogue — `kqjdtjygrvpwcnexqtbz` (region `ap-south-1`)
  - Warning: a second, empty Supabase project (`rmczsjbqtrvbclkyvtwa`, ap-southeast-2) was
    auto-created at signup and is unused. Never deploy to it.
- **Supabase URL:** `https://kqjdtjygrvpwcnexqtbz.supabase.co`

## Environment variables (set in Vercel project settings, not in repo)
| Key | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kqjdtjygrvpwcnexqtbz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key, safe client-side |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, bypasses RLS — never expose client-side |
| `ADMIN_PASSWORD` | Gates `/admin` |
| `ADMIN_SESSION_SECRET` | HMAC signing secret for the admin session cookie |

## Architecture notes
- **Public pages** (`app/page.tsx`, `app/category/[slug]/page.tsx`) use the
  anon Supabase client (`lib/supabase-public.ts`) — read-only, RLS-enforced.
- **Admin pages** (`app/admin/**`) use the service-role client
  (`lib/supabase-admin.ts`) — full read/write, bypasses RLS. Protected by
  `middleware.ts`, which checks a signed cookie (Edge-Runtime-safe, uses
  Web Crypto API, not Node's `crypto`).
- **Logo** is pure vector (`components/Logo.tsx`) — SVG + styled text, not a
  raster image. Never reintroduce PNG/JPG logos; they degrade badly when
  pushed through this deploy pipeline.
- **Settings** (WhatsApp number, location, contact name, Instagram) live in
  the `settings` table (key/value), fetched via `lib/settings.ts`. Editable
  in the DB without a redeploy — no admin UI for this yet, would be a good
  next addition.
- **Photos** can come from Supabase Storage (`storage_path`) or a linked
  Google Drive file (`drive_id`, rendered via
  `lh3.googleusercontent.com/d/{id}=w{size}`). Both paths are unified
  wherever photo URLs are built.
- **Category to shape/color/tag/size linking** is many-to-many via join
  tables (`category_shapes`, `category_colors`, `category_tags`,
  `category_shape_sizes`), letting different categories offer different
  size subsets of the same shape.
- **WhatsApp enquiry** buttons build a `wa.me` deep link
  (`lib/whatsapp.ts`) with a message pre-filled from the photo's
  category/shape/size/color.

## Brand system
- Colors: Navy `#1B3A6B`, Deep Ink `#12233F`, Champagne Gold `#9C7A25`,
  Ivory `#FAF8F3`, Charcoal `#3A3F44`
- Fonts: Playfair Display (headings), Jost (body/UI) — loaded via Google
  Fonts `@import` in `globals.css`
- Tagline: "Synthetic Gemstones. Infinite Choices. One Trusted Name."

## Deploying
This project has been deployed via direct file upload (no git-based CI) so far.
To set up proper git-based deploys:
1. Push this folder to a new GitHub repo
2. In Vercel -> yoyo-gems-catalogue -> Settings -> Git, connect the repo
3. Future pushes to `main` will auto-deploy

## Local dev
```
npm install
npm run dev
```
Requires a `.env.local` with the env vars listed above.
