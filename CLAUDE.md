# CLAUDE.md — Merhav (מרחב) Project Context

> This file is read automatically by Claude Code when it opens the project. It contains the full context of what was built and what's next.

## Project: Merhav (מרחב) — Therapist Marketplace

A multilingual web platform that connects users with licensed therapists. Currently a static HTML prototype built in three languages.

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

## Design System (already in the HTML)

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
