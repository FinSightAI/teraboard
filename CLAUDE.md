# CLAUDE.md — TeraBoard Project Context

> This file is read automatically by Claude Code when it opens the project. It contains the full context of what was built and what's next.

## Project: TeraBoard — Therapist Marketplace

A multilingual web platform that connects users with licensed therapists. Static HTML (no build step) with a Supabase data layer wired in.

> **Brand:** TeraBoard (logo mark "T"). Renamed from the earlier working name "Merhav / מרחב".

## Status (updated 2026-06-05) — Goals 1–3 done

- **Goal 1 — Deployed.** Live in production at **https://teraboard.vercel.app**
  (Vercel project `teraboard`, scope `finsightai-4755s-projects`). `/he` `/en` `/pt` clean routes work.
- **Goal 2 — Backend scaffolded.** `supabase/schema.sql` (therapists/reviews/bookings + RLS +
  `licenses` storage bucket + seed of the 12 sample therapists). `js/data.js` is a data layer that
  fetches from Supabase when configured and **falls back to each page's sample array** otherwise, so
  the site works before and after the DB is connected. Boards persist bookings via `TeraData.createBooking`.
- **Goal 3 — Therapist signup.** `for-therapists.html`: Supabase Auth (email/password), license upload to
  the `licenses` bucket, profile builder (upsert into `therapists`), and a bookings dashboard.
- **Profile pages.** `therapist.html` = tri-lingual full profile, shareable at **`/t/<id>`**
  (rewrite → `therapist.html?id=`); Supabase-by-id with a `sessionStorage` fast-path from the boards.
  Cards' "view profile" → `viewProfile()`. Therapists also have `website_url` + `instagram` (client-visible
  icons on cards + profile). Why `/t/` not `/therapist/`: a rewrite to `/therapist.html` collides with cleanUrls
  (404); destination must be the clean path `/therapist?id=:id`.
- **Design = "Celestial"** spiritual theme (see Design System below). Single file `css/celestial.css`.

### Open product decision (not yet built)
**Monetization model** is undecided. Guidance given: therapy is a high-leakage category; at cold-start
charge nothing — seed supply (free "founding therapists"), pick a narrow city+specialty wedge, give
single-player value (shareable profile), manufacture demand, monetize only proven value later. You can
only reliably bill on what flows through the platform (on-platform payments) or on delivered leads.

### ⚠️ Remaining manual step to go fully live
The backend is **not connected yet** — it runs on sample data until credentials are added:
1. Create a Supabase project (region EU/Frankfurt).
2. Run `supabase/schema.sql` in the SQL Editor.
3. Put the Project URL + anon key into `js/config.js` (and as Vercel env if desired), then redeploy.

Deploy command used: `vercel deploy --prod --yes --scope finsightai-4755s-projects`

## Current State

Three working HTML prototypes (single-file each, no build step needed):

- `therapist-board.html` — Hebrew (RTL), prices in ₪, Israeli cities
- `therapist-board-en.html` — English (LTR), prices in $, global cities
- `therapist-board-pt.html` — Portuguese (LTR), prices in R$, BR + PT cities

All three share the same structure:
- Hero with search bar (free text + location dropdown)
- 8 category chips (Psychotherapy, Couples, Kids, CBT, Art, Body-Mind, Addiction, All)
- Grid of 12 sample therapist cards with: avatar, name, specialty, rating, reviews, price, "Online" badge
- Sort dropdown (rating / price / reviews)
- Booking modal with name/phone/session-type/time-slot picker
- Language switcher in the header (HE / EN / PT)
- Responsive mobile breakpoint at 720px
- Color palette: forest green `#3a5a4a` / sage `#7ba990` / cream `#f7f5f1`
- Font: Heebo (HE) / Inter (EN, PT)

The data is hardcoded in a `therapists` array inside each file's `<script>` tag. No backend yet.

## Goals — What to Build Next

The user wants to take this from prototype to a real live product. Priority order:

### 1. Deploy the prototype as-is to Vercel
- Initialize git
- `vercel deploy` to get a live URL
- Optional: connect a custom domain (e.g. merhav.co.il or similar)

### 2. Add a real backend
Pick **Supabase** (recommended — Postgres + auth + storage + realtime, has a generous free tier).
Schema needed:
- `therapists` (id, name, speciality, category, area, online, price, bio, photo_url, license_number, verified, created_at)
- `reviews` (id, therapist_id, user_id, rating, comment, created_at)
- `bookings` (id, therapist_id, user_id, datetime, type, status, notes, created_at)
- `users` (handled by Supabase Auth)

Replace the hardcoded array with a fetch from Supabase. Add loading and empty states.

### 3. Therapist sign-up flow
A separate `/for-therapists` page where licensed therapists can:
- Sign up
- Upload license/credentials (for manual verification)
- Build their profile (photo, bio, specialties, prices, availability calendar)
- See their bookings dashboard

### 4. Payments
Integrate **Stripe** (or **Tranzila** if Israeli-only) for taking session fees with platform commission.

### 5. Polish
- Real photos for therapists (instead of initial letters)
- Full profile page (`/therapist/[id]`)
- Working filter combinations and URL state (so filters can be shared/bookmarked)
- SEO meta tags + sitemap
- Analytics (Plausible or PostHog)

## Tech Stack Recommendations

For the next iteration the user should likely migrate from static HTML to a framework. Recommended:

- **Next.js 14 (App Router)** — gives SEO, dynamic routes for therapist profiles, API routes for booking logic
- **Tailwind CSS** — instead of the current inline `<style>` (current CSS is well-structured and easy to port)
- **Supabase** — backend, auth, storage
- **Stripe** — payments
- **Vercel** — hosting (auto-deploys from git)
- **next-intl** or **next-i18next** — for the HE/EN/PT translations (instead of three separate HTML files)

When migrating, preserve the visual design — the user already approved it.

## Design System — "Celestial" (current)

Spiritual / holistic theme: amethyst · indigo · gold on a lavender mist, with
lotus motifs and soft auras. Single source of truth is **`css/celestial.css`**
(CSS variables + fonts that auto-switch by `<html lang>`). All 5 pages link it —
no per-page `<style>` blocks. (An earlier "Warm Botanical" terracotta/olive theme
was rejected by the user in favour of this purple/spiritual direction.)

```
Violet (CTA):      #6d4fb0  (hover #553c92)
Amethyst:          #8a6fd1
Indigo (2nd btns): #3a2b63
Lavender mist bg:  #f4effb → #e7dcf5 (mist + violet/gold radial auras)
Card:              #fdfbff
Ink (text):        #2c2440   Ink soft: #74688f
Line/border:       #e7def5   Gold (stars): #c2a14e
Fonts — display:   Cormorant Garamond (EN/PT), Frank Ruhl Libre (HE);  body: Mulish (EN/PT), Heebo (HE)
Motifs:            five-petal lotus SVG (hero crown + card watermark); staggered card entrance animation
```

To restyle, edit `css/celestial.css` only. The original green/sage prototype palette below is kept for reference.

## Design System (original prototype — superseded by Warm Botanical)

```
Primary green:    #3a5a4a
Primary hover:    #2c4538
Accent sage:      #7ba990
Light sage:       #c9d8cd
Background:       #f7f5f1 → #ebe7e0 (gradient)
Text primary:     #1f2e26
Text secondary:   #6b6862
Card border:      #e6e2db
Star/badge gold:  #f5b342

Border radius:    22px (cards), 100px (pills/buttons), 10px (small)
Card shadow on hover: 0 18px 40px rgba(58,90,74,0.15)
```

## Notes

- The Hebrew version uses RTL (`dir="rtl"`). When refactoring, keep the language attr-driven so direction flips automatically.
- The "Recommended" / "New" badges are positioned `right: 16px` in Hebrew and `left: 16px` in English/Portuguese — this is intentional for RTL.
- All three files are self-contained — no external dependencies except Google Fonts and emoji.

## Quick Start for Deployment

```bash
# 1. Install Vercel CLI (if not installed)
npm i -g vercel

# 2. Deploy current state
vercel

# 3. Production deploy
vercel --prod
```

The `vercel.json` in the repo already maps the Hebrew version as the index.
