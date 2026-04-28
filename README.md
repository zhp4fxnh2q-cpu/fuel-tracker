# FUEL

Adaptive nutrition tracker for David Rogers. Real deployed app on Cloudflare Pages,
backed by the same Supabase project that hosts the meal planner. Single-user only,
gated by Google OAuth to two emails.

## Stack

- React 18 (`react-scripts 5.0.1`) — single-file pattern matching the meal planner
- Supabase JS — auth + primary data store
- Dexie (planned for Phase 3) — local IndexedDB queue for offline food logs
- Recharts — weight + energy-balance charts
- Cloudflare Pages — hosting, auto-deploys on push to `main`
- Cloudflare Worker (planned for Phase 3) — proxies USDA + Anthropic API keys

## Phase 1 — what's live

- Google sign-in (Supabase `signInWithIdToken`) gated to `rogersdna15@gmail.com` and
  `david@providenceswfl.com`
- 5-tab bottom nav: Today · Log · Weight · Trends · Settings
- Settings boots a `fuel_settings` row with David's profile
- PWA manifest + icons → installable to iPhone home screen
- Adherence-neutral dark theme, fresh-green wordmark distinct from FORGE's amber
- `lib/algorithm.js` shipped pure-functional with EWMA smoothing, Mifflin-St Jeor
  cold-start, 14-day TDEE back-solve, blended cold-start, weekly review with
  ±200 kcal cap, intra-day smart rebalance with floors, and the diet-break check

## Phase 2 — to do (one-time SQL run)

Open `https://supabase.com/dashboard/project/nuixrqyzzwkpdwzzkjsg/sql/new` and paste
the contents of `migrations/0001_fuel_initial.sql`. Run. That creates all six
`fuel_*` tables and locks them to the shared user_id with RLS.

After running, reload the FUEL app — Settings will switch from the
"database setup needed" warning to the live profile editor.

## Algorithm decisions baked in

- `EWMA_ALPHA = 0.12` (today's reading 12%, trend 88%)
- Protein floor: 1 g per lb body weight
- Fat floor: 0.3 g per lb body weight
- Training-day calorie floor: 2,200 kcal hard stop
- Training-day carb floor: 100 g (warning if math forces below)
- Weekly kcal change cap: ±200 kcal
- Diet-break prompt: 8 weeks in cutting phase
- Intra-day rebalance: smart, with floors (overshoot at lunch shrinks dinner carbs;
  refuses to rebalance if it would breach any floor)

## Deployment

GitHub repo: `zhp4fxnh2q-cpu/fuel-tracker` (private)
Live URL: `https://fuel-tracker.pages.dev` (after Cloudflare Pages connection)

Push pattern from a Claude session:

```bash
cd /tmp && rm -rf fuel-push
git clone https://${GH_PAT}@github.com/zhp4fxnh2q-cpu/fuel-tracker.git fuel-push
# edit files
cd fuel-push
git -c user.name="FUEL Builder" -c user.email="RogersDNA15@gmail.com" add -A
git -c user.name="FUEL Builder" -c user.email="RogersDNA15@gmail.com" commit -m "..."
git push
```

Cloudflare Pages auto-deploys from `main` push. Build settings:
- Build command: `npm run build`
- Output directory: `build`
- Node version: 20

## Roadmap

| Phase | What | Status |
|------|------|--------|
| 1 | Skeleton + auth + first deploy | done |
| 2 | Supabase migration | SQL ready, needs to be run |
| 3 | Food logging core (USDA search, quantity picker, Worker) | next |
| 4 | Meal planner integration (pull tonight's dinner) | |
| 5 | Weight tracking + EWMA chart | |
| 6 | Adaptive TDEE algorithm + Sunday review modal | |
| 7 | Trends + AI coaching | |
| 8 | Saved meals | |
| 9 | Reverse dieting + diet break protocols | |
| 10 | Polish, AI fallback, exports | |

## Legacy

The Vite/D1/Tailwind first attempt (April 14) is preserved on branch
`legacy/vite-d1-first-attempt`. `algorithm.js` was ported from there with
spec constants applied.
