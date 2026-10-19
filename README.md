# BrewLab.ai / Recipe Studio

A working Next.js App Router PWA based on the supplied Stitch screen. Styled-components handles all application styling; no Tailwind is used. Drafts, inventory, settings, and recipe snapshots persist in IndexedDB. Connected services require your own credentials.

## Run Locally

Requires Node.js 22.14+ (Node 24 recommended).

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Manual formulation works without environment variables. Starter inventory and stockist catalogs are clearly marked sample data, not live prices or actual inventory.

For installable PWA and offline testing:

```sh
npm run build
npm start
```

Service workers are disabled in development. The production worker caches the public application shell, local fonts, icons, and static assets only. API, OAuth, and Supabase responses are not cached. Revisit the studio once online before testing an offline reload. AI, OAuth, and inventory sync require a connection. Offline drafting does not require signing in.

## Project Structure

```text
app/
  layout.tsx                   SSR registry and self-hosted fonts
  page.tsx                     Recipe studio
  manifest.ts                  Installable PWA metadata
  auth/actions.ts              Google OAuth server action
  auth/login/route.ts          OAuth entry point
  auth/callback/route.ts       PKCE code-to-cookie exchange
  api/ai/route.ts              Authenticated OpenAI tool loop
  api/brewfather/sync/route.ts  Inventory sync
  api/recipes/route.ts         Recipe persistence
  api/suppliers/               Catalog persistence and approved feed refresh
  api/workspace/route.ts       Account hydration and inventory persistence
components/
  providers.tsx                ThemeProvider and global styled-components styles
  recipe-studio.tsx            Interactive formulation workbench
  ui.tsx                       Modular styled UI primitives
lib/
  registry.tsx                 ServerStyleSheet / useServerInsertedHTML registry
  theme.ts                     Light/dark, typography, spacing, SRM tokens
  store.ts                     Zustand + IndexedDB persistence
  calculations.ts              brewcalc adapter and water chemistry
  optimizer.ts                 Inventory-first, single-supplier cart selection
  schemas.ts                   Zod runtime and AI JSON schemas
  ai.ts                        Prompt and structured function-calling tools
  brewfather.ts                v1/v2 pagination and metric normalization
  export.ts                    BeerXML, Brewfather JSON, native JSON export
  supabase/                    Cookie-based server and browser clients
supabase/migrations/001_brew_lab.sql
supabase/rls.test.ts            Executable PostgreSQL RLS tests
worker/index.js                Legacy runtime-cache cleanup
public/                        PWA icons and offline fallback
design/stitch/                 Downloaded original HTML, screenshot, and avatar
open-next.config.ts
wrangler.jsonc
```

## Supabase & Google OAuth

1. Create a Supabase project and apply [the migration](supabase/migrations/001_brew_lab.sql) in the SQL editor, or run `supabase db push` with the Supabase CLI linked to your project. The migration includes `users`, `inventories`, `suppliers`, `recipes`, RLS policies, profile creation, and per-user API quotas.
2. Create a Google OAuth web client. Set its authorized callback to `https://YOUR_PROJECT.supabase.co/auth/v1/callback` and enable Google under Supabase Authentication > Providers. Keep the Google client secret in Supabase, not this app.
3. Under Supabase Authentication > URL Configuration, set the Site URL to your app origin and allow `http://localhost:3000/auth/callback` and your deployed `/auth/callback` URL.
4. Create a local `.env.local` using the names in [.env.example](.env.example), then restart Next.js. Set `NEXT_PUBLIC_SITE_URL` to the actual origin, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the publishable/anon project credentials. Never use the Supabase service-role key in the client.
5. Sign in from the account button. Every authenticated route verifies `auth.getUser()`, refreshes cookies, checks ownership through RLS, and rejects cross-origin mutations. No experimental middleware is needed.

Signing out clears account-specific inventory, catalogs, saved recipes, and active recipe data from the local store. Local drafts are not encrypted; do not treat a shared browser as private storage. Public Supabase variables are embedded at build time and must be set before building.

## Brewfather Inventory

Generate a Brewfather key with `inventory.read`, sign in, then open My inventory > Sync Brewfather. Enter the user ID and API key in the masked form. Credentials are used for that request only, never persisted or logged by the app.

The requested v1 integration uses offset pagination. Brewfather now deprecates v1; select v2 for cursor pagination. Both read fermentables, hops, yeasts, and water-agent miscellaneous stock. Grain inventory is converted from grams to kg, hops/salts remain grams, and yeast remains packs. Original fields, including batch metadata when supplied, are preserved in `metadata`.

A sync saves only after every collection completes; upstream failures never replace a complete inventory with a partial one. HTTP 429 and invalid credentials produce actionable errors. The application permits six sync/feed refreshes per user per hour in addition to Brewfather's own quota.

## AI Recipe Generation

Set `OPENAI_API_KEY` server-side and optionally `OPENAI_MODEL` (default `gpt-4.1-mini`). Google OAuth and the Supabase migration are prerequisites. Keys are not included in browser bundles.

[lib/ai.ts](lib/ai.ts) contains the inventory-first system prompt and the `get_inventory`, `evaluate_recipe`, and `propose_recipe` tools. The first call must read the signed-in user's inventory and supplier catalogs. Zod generates strict JSON schemas and validates every returned recipe. Server-side calculations and sourcing results are authoritative; model-supplied metrics are not trusted. Changes remain proposals until the user clicks Apply. Thirty requests per user per hour and five tool rounds per request bound usage.

## Stockists & Single-Supplier Sourcing

Built-in starter catalogs for The Malt Miller and Get Er Brewed are **sample estimates**. They are not scraping integrations or verified current availability. Add real stockists and import their product catalog through the stockist form. Package sizes use kg for grains, grams for hops/salts, and packs for yeast. Stock is the number of available packages.

```json
[
  {
    "ingredient": "Citra",
    "kind": "hop",
    "packageSize": 100,
    "price": 7.25,
    "stock": 10,
    "substitutes": []
  }
]
```

For an approved supplier API, set server-only `STOCKIST_FEEDS` to a JSON map of saved supplier IDs to HTTPS catalog URLs. The feed must return the product array above. `POST /api/suppliers/refresh` with `{ "id": "SAVED_SUPPLIER_ID" }` fetches that configured feed and validates it before replacing the catalog. URLs cannot be supplied by the browser, redirects are rejected, and response size/time are bounded. Only configure feeds you trust and are authorized to access. Vendor-specific scraping requires permission and a connector for that vendor; no arbitrary URL scraping is enabled.

[lib/optimizer.ts](lib/optimizer.ts) aggregates repeated ingredients, subtracts exact-name local stock, rounds shortfalls to packages, checks package stock, and rejects every supplier that cannot fulfill the entire basket. Only explicitly declared catalog substitutions are eligible, and they can be disabled. Shipping is included. Options are grouped by currency; there is no foreign-exchange conversion, so compare prices only within the same currency. Shopping lists export as CSV, not an automatically purchased cart.

## Brewing Estimates

- Gravity, attenuation, ABV, Morey SRM/EBC, and Tinseth IBU use `brewcalc`.
- A tracked `patch-package` patch replaces the library's legacy dynamic-eval global shim with `globalThis`. The readable entry point is imported explicitly, and `npm ci` applies the patch automatically. A strict-runtime regression test and a real local Worker smoke test verify compatibility; do not remove the patch when updating dependencies without repeating those checks.
- Boil gravity accounts for batch volume, boil time, and boil-off. Whirlpool utilization is an estimate of 25% of equivalent boil utilization; dry hops contribute no Tinseth IBU. Alpha decay is an explicit simplified estimate of 5% per stored month, not a hop-storage-index model.
- Water additions assume gypsum and calcium chloride **dihydrate**, distributed over the target batch volume. Source Ca/SO4/Cl are editable. The app does not calculate mash pH or water alkalinity.
- The SRM swatch is approximate. Fermentation and brewhouse results require real measurements.
- BeerXML and Brewfather JSON export recipes for import; native BrewLab.ai JSON supports round-trip imports. Hardware control and direct recipe push are not implemented.

## Cloudflare Deployment

```sh
npm run cf:build
npm run preview
```

The OpenNext adapter emits `.open-next/worker.js` and `.open-next/assets`. [wrangler.jsonc](wrangler.jsonc) enables `nodejs_compat` and binds static assets. Routes run on the Cloudflare Workers Node compatibility runtime; do not add Next's `runtime = 'edge'` to these routes.

Before deploying, set production public variables in your build environment, update `NEXT_PUBLIC_SITE_URL`, add the production callback URL to Supabase, and configure server-only Worker secrets:

```sh
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put OPENAI_MODEL
npx wrangler secret put STOCKIST_FEEDS
npm run deploy
```

Only set optional secrets you need. A Cloudflare account and Wrangler authentication are required for deployment. No credentials, OAuth provider settings, or production database have been provisioned automatically.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run cf:build
```

Tests cover brewing calculations, single-supplier selection, API origin/body boundaries, Brewfather v1/v2 pagination, and actual PostgreSQL RLS/quota behavior using PGlite. Live Google OAuth, Brewfather, supplier feeds, and OpenAI calls require configured credentials and are not covered by mocked or local tests. `npm audit` currently reports upstream build-tool advisories in the requested PWA/lint dependency tree, including `braces`; review these before production release rather than forcing framework downgrades.
