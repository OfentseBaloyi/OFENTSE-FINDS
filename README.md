# OFENTSE-FINDS

**Discover more. Right around you.**

A South African local-discovery web app: pick a town or suburb and see its food spots, mechanics, car washes, shops, services, attractions and hidden gems on an interactive map.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Supabase, Leaflet and OpenStreetMap.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in your publishable key
npm run dev                  # http://localhost:3000
```

The app works before the database is set up. Places come live from OpenStreetMap, and towns and categories come from the built-in seed data. Run the migrations below to enable business submissions, verified listings and the admin area.

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Your project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | The **publishable** key only. Never put a secret or service-role key in this app. |
| `NEXT_PUBLIC_SITE_URL` | yes | Used for metadata and admin sign-in redirects |
| `OSM_CONTACT` | recommended | A contact email sent in the User-Agent to OpenStreetMap services, as their policies require |
| `FEATURED_TOWN` | no | Town slug used for the homepage sections (default `pretoria`) |
| `OVERPASS_URLS` | no | Comma-separated Overpass endpoints, tried in order |
| `NEXT_PUBLIC_MAP_TILE_URL` / `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` | no | Use a commercial tile provider for production traffic |

`.env.local` is git-ignored.

## Database setup (Supabase)

The publishable key can't create tables, so run the migrations once in the **Supabase dashboard → SQL Editor**, in this order:

1. `supabase/migrations/20261012000000_initial_schema.sql`: tables, Row Level Security, moderation functions, storage buckets.
2. `supabase/migrations/20261012000100_seed_towns_categories.sql`: 5 category groups, 41 categories, 49 towns.

Both files are idempotent (`if not exists` / `on conflict`), and neither drops or overwrites existing data. With the Supabase CLI, `supabase db push` runs them too.

### Make yourself an admin

1. In **Authentication → Users**, add your user (or invite yourself by email).
2. In **Authentication → URL Configuration**, add `http://localhost:3000/admin` and your production `/admin` URL to the redirect URLs.
3. In the SQL Editor run:

```sql
insert into public.admin_users (user_id)
select id from auth.users where email = 'you@example.com';
```

4. Visit `/admin`, request a sign-in link, and review submissions there.

### Security model

- RLS is enabled on every table.
- Anyone can **read** towns, categories and non-suspended businesses.
- Anyone can **insert** a `business_submissions` row. A trigger forces it to `pending`, and CHECK constraints enforce the same limits as the form. Nobody but admins can read submissions.
- Only admins (`public.admin_users`) can write towns, categories or businesses. Approval goes through `approve_submission()`, a `SECURITY DEFINER` function that re-checks `is_admin()` and requires confirmed coordinates.
- Submission photos go to a **private** bucket (`business-submission-images`). Admins can publish an approved photo to the public `business-images` bucket.

## How the data works

- **Places**: [`src/lib/places.ts`](src/lib/places.ts) is the provider layer. It merges live OpenStreetMap results ([`providers/overpass.ts`](src/lib/providers/overpass.ts)) with Supabase listings ([`db.ts`](src/lib/db.ts)). To add a commercial Places API, add a provider and merge it the same way.
- **Categories**: [`src/data/categories.ts`](src/data/categories.ts) maps each category to OpenStreetMap tags. Adding a category is a data change. Re-run `node scripts/build-seed-sql.mjs` to update the seed SQL.
- **Towns**: [`src/data/towns.generated.json`](src/data/towns.generated.json) holds real coordinates from Nominatim, plus descriptions and CC-licensed photos from Wikipedia and Wikimedia Commons with credits. Rebuild it with `node scripts/build-town-seed.mjs`. Any other town or suburb is geocoded on demand.
- **Nothing is invented**: coordinates, ratings, review counts and opening hours appear only when a real source provides them. Sorting by "Highest rated" stays disabled until rating data exists. "Recommended" means verified listings first, then the most complete information, then distance.

### Being a good citizen of free OpenStreetMap services

- Overpass queries are area-first, capped in radius and result count, limited to 2 at a time, and cached for 12 hours in memory and on disk. If Overpass is down, results up to 30 days old are served instead, and a circuit breaker stops retries for a minute.
- Nominatim is called at most once per second. It is never used for autocomplete, which autocompletes against the local town list instead. Results are cached for 30 days.
- The public Overpass servers are sometimes overloaded. The app then shows a clear "service busy" state and recovers on its own. For production, consider a dedicated Overpass instance or a commercial places provider.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build && npm start` | Production build and serve |
| `npm run typecheck` | TypeScript check |
| `node scripts/build-town-seed.mjs` | Rebuild town seed data from Nominatim and Wikipedia (slow by design: 1 request/second) |
| `node scripts/build-seed-sql.mjs` | Regenerate the seed SQL migration |

## Credits

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL). Town descriptions from Wikipedia. Photos from Wikimedia Commons, credited on each page. Homepage photo: *Johannesburg skyline 2017* by Mark Hillary, CC BY 2.0.
