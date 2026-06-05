# Merhav (מרחב) — Therapist Marketplace

Multilingual web platform connecting users with licensed therapists.

## What's in this folder

- `index.html` → redirects to the Hebrew version
- `therapist-board.html` → Hebrew (RTL)
- `therapist-board-en.html` → English
- `therapist-board-pt.html` → Portuguese
- `CLAUDE.md` → full project context for Claude Code
- `vercel.json` → Vercel deployment config

## Run locally

Just open `index.html` in your browser. No build step.

Or with a quick local server:
```bash
npx serve .
```

## Deploy to Vercel

```bash
# First time
npm i -g vercel
vercel login
vercel

# After that
vercel --prod
```

## Working with Claude Code

Open this folder in Claude Code:
```bash
cd path/to/this/folder
claude
```

Claude Code will automatically read `CLAUDE.md` and know exactly where the project is and what to build next. You can immediately ask things like:
- "deploy this to Vercel"
- "migrate to Next.js + Supabase"
- "add a therapist sign-up page"
- "connect Stripe"

## Languages

The three HTML files are linked via a language switcher in the header. To add a new language, copy one of the existing files and translate the static strings + the data arrays.
