# Shelfie

A calm, private book tracker for building a library, discovering modern reads,
valuing owned books, logging reading, and keeping a book-specific journal.

## Current features

- Bookshelf, collection, wishlist, DNF, ratings, signed copies, and manual books
- Google Books/Open Library discovery with cached physical-book pricing
- Private reading sessions, page progress, streaks, and daily quests
- Private per-book journal with search, filters, sorting, editing, and spoilers
- 100 server-verified achievements and a gradual 1–100 reader level curve
- Supabase authentication, Row-Level Security, and private proof-photo storage

## Local development

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

Copy `.env.example` to `.env.local` and supply the public Supabase browser
configuration. Provider secrets belong in Supabase Edge Function secrets, never
in the Vite client.

Database changes are versioned in `supabase/migrations/` and should be applied
in filename order before deploying a frontend that depends on them.
