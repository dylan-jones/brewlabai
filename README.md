# BrewLab.ai / Recipe Studio

A working Next.js App Router PWA based on the supplied Stitch screen. Styled-components handles all application styling; no Tailwind is used. Drafts, inventory, settings, and recipe snapshots persist in IndexedDB. Connected services require your own credentials.

## Run Locally

Requires Node.js 22.14+ (Node 24 recommended).

```sh
npm ci
npm run db:migrate:local
npm run dev
```

Open http://localhost:3000. Logged-out users see the login/sign-up screen. Configure Google authentication below to enter Recipe Studio. New workspaces start with an empty recipe, inventory, and stockist list. In-progress drafts are restored automatically. Local D1 uses Wrangler's SQLite-backed emulator; no Cloudflare account is needed for local migrations or tests.

For installable PWA and offline testing:

```sh
npm run build
npm start
```

Service workers are disabled in development. The production worker caches static assets and the public offline fallback only. Authenticated HTML, API responses, and OAuth responses are not cached. An already-open studio can keep local drafts offline, but reloading offline shows the fallback. Google login, AI, and inventory sync require a connection.

## Project Structure

```text
app/
  layout.tsx                   SSR registry and self-hosted fonts
  page.tsx                     Session-gated login / recipe studio
  profile/page.tsx             Authenticated account and connection settings
  manifest.ts                  Installable PWA metadata
  auth/actions.ts              Google OAuth server action
  auth/login/route.ts          OAuth entry point
  api/auth/[...all]/route.ts   Better Auth Google callback and session endpoints
  api/ai/route.ts              Authenticated OpenAI tool loop
  api/brewfather/sync/route.ts  Inventory sync
  api/recipes/route.ts         Recipe persistence
  api/suppliers/               Catalog persistence and approved feed refresh
  api/workspace/route.ts       Account hydration and inventory persistence
  api/profile/route.ts         Safe profile metadata and encrypted key updates
components/
  providers.tsx                ThemeProvider and global styled-components styles
  auth-screen.tsx              Google login and sign-up
  profile-page.tsx              Provider setup guides and saved connection settings
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
  profile.ts                   Server-only profile credential access
  credentials.ts               AES-256-GCM credential encryption
  brewfather.ts                v1/v2 pagination and metric normalization
  export.ts                    BeerXML, Brewfather JSON, native JSON export
  auth.ts                      Better Auth with Google and D1-backed sessions
  db.ts                        Cloudflare D1 binding access
  workspace-db.ts              User-scoped account data and quotas
  workspace-db.test.ts         Real local D1 isolation and quota tests
migrations/0001_brew_lab.sql   D1 auth and application schema
migrations/0002_user_profiles.sql  Encrypted per-user connection settings
worker/index.js                Legacy runtime-cache cleanup
public/                        PWA icons and offline fallback
design/stitch/                 Downloaded original HTML, screenshot, and avatar
open-next.config.ts
wrangler.jsonc
```

## Google Authentication & D1

Authentication uses Better Auth with Google; users, sessions, OAuth state, and account data are stored in Cloudflare D1. No external authentication or database service is required.

1. Create a Google OAuth **Web application** client in Google Cloud Console. Configure the consent screen and add test users while the app is in testing mode.
2. Add authorized redirect URIs `http://localhost:3000/api/auth/callback/google` and `https://YOUR_APP_DOMAIN/api/auth/callback/google`. If requested, the corresponding JavaScript origins are `http://localhost:3000` and `https://YOUR_APP_DOMAIN`.
3. Create `.env.local` using [.env.example](.env.example). Set `BETTER_AUTH_URL` to the app's exact origin, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`. Generate `BETTER_AUTH_SECRET` with `openssl rand -base64 32`. Keep these credentials server-side; do not use `NEXT_PUBLIC_` variables for them.
4. Run `npm run db:migrate:local`, restart `npm run dev`, and sign in. The zero UUID in [wrangler.jsonc](wrangler.jsonc) is a local-only placeholder; replace it with your real D1 ID before deploying.

Login and sign-up use the same Google OAuth flow; first-time users are created automatically. Better Auth handles OAuth state, secure session cookies, and database-backed auth rate limits. Every protected API validates the session and uses a user-scoped D1 helper with parameterized queries. Browser mutations also reject cross-origin requests. D1 does not have PostgreSQL row-level security, so ownership checks live in the server-side data layer and are tested against local D1.

Signing out invalidates the server session and clears account-specific inventory, catalogs, saved recipes, and active recipe data from the local store. Local drafts are not encrypted; do not treat a shared browser as private storage. This schema is for a fresh D1 database; existing data in another database is not imported automatically.

## Profile & Encrypted Credentials

The account button opens `/profile`. Each user can choose GPT (OpenAI), Gemini (Google), or Claude (Anthropic), select a model ID, and save an API key. The page shows provider-specific key-generation instructions and links. It also stores the Brewfather user ID, API version, and API key. Changing AI providers preserves the other providers' saved keys. An empty key field keeps the saved key; Remove saved key deletes it from the profile without revoking it at the provider.

Before saving credentials, generate a dedicated encryption key with `openssl rand -base64 32` and set `CREDENTIAL_ENCRYPTION_KEY` in the local server environment. Do not reuse `BETTER_AUTH_SECRET` or expose this value through a `NEXT_PUBLIC_` variable. Apply `npm run db:migrate:local` locally and `npm run db:migrate:remote` in production to create the profile table.

API keys are encrypted before database writes using AES-256-GCM with random 96-bit nonces and authenticated user/service binding. Only the server decrypts them for provider requests; profile responses return saved-key flags, never plaintext keys or ciphertext. Keys are not written to IndexedDB, localStorage, prompts, or application logs. Use HTTPS in production. The application server can decrypt credentials, so this is encryption at rest, not end-to-end encryption.

Keep the encryption key in a Cloudflare Worker secret, separate from D1, and back it up securely. Replacing or losing it makes existing encrypted credentials unreadable; users must re-enter their keys unless a separate re-encryption migration is performed. Profile saves fail closed when encryption is not configured. Live provider validation occurs when generating a recipe or syncing, not when saving a key.

## Brewfather Inventory

Generate a Brewfather key with `inventory.read`, sign in, then open Your profile > Brewfather. Save the user ID and API key in the masked form. Credentials are encrypted in the profile and reused for inventory sync from the profile page or My inventory. Browser sync requests do not contain the saved key.

The requested v1 integration uses offset pagination. Brewfather now deprecates v1; select v2 for cursor pagination. Both read fermentables, hops, yeasts, and water-agent miscellaneous stock. Grain inventory is already returned in kg and is kept in kg; hop stock remains in grams. Sync requests in-stock items and also filters out zero, negative, null, and missing stock locally. Original fields, including batch metadata when supplied, are preserved in `metadata`.

A sync saves only after every collection completes; upstream failures never replace a complete inventory with a partial one. HTTP 429 and invalid credentials produce actionable errors. The application permits six sync/feed refreshes per user per hour in addition to Brewfather's own quota.

## AI Recipe Generation

Choose the AI provider and model in Your profile and save your own API key. Google authentication, the D1 profile migration, and server-side credential encryption are prerequisites. The AI SDK uses the selected provider's adapter; no shared `OPENAI_API_KEY` or `OPENAI_MODEL` environment variable is used. API usage is billed by the provider to the user's API account, separately from chat subscriptions.

[lib/ai.ts](lib/ai.ts) contains the inventory-first system prompt and the `get_inventory`, `evaluate_recipe`, and `propose_recipe` tools. The first call must read the signed-in user's inventory and supplier catalogs. Zod schemas validate tool inputs and every returned recipe. Server-side calculations and sourcing results are authoritative; model-supplied metrics are not trusted. Changes remain proposals until the user clicks Apply. Thirty requests per user per hour and five tool rounds per request bound usage.

## Stockists & Single-Supplier Sourcing

No stockists, product prices, or inventory are preloaded. Add your own stockists and import their product catalog through the stockist form. Package sizes use kg for grains, grams for hops/salts, and packs for yeast. Stock is the number of available packages. Ingredient selectors contain reference brewing properties, not owned inventory or supplier stock.

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

BJCP style suggestions use the official [2021 beer guidelines](https://www.bjcp.org/style/2021/beer/), checked against the [BJCP style index](https://www.bjcp.org/beer-styles/beer-style-guidelines/). The searchable datalist includes all 34 categories and named Specialty IPA and Historical Beer variants, while retaining custom recipe styles. The list is bundled locally and does not require a live BJCP request. Provisional styles are separate from this published edition.

- Gravity, attenuation, ABV, Morey SRM/EBC, and Tinseth IBU use `brewcalc`.
- A tracked `patch-package` patch replaces the library's legacy dynamic-eval global shim with `globalThis`. The readable entry point is imported explicitly, and `npm ci` applies the patch automatically. A strict-runtime regression test and a real local Worker smoke test verify compatibility; do not remove the patch when updating dependencies without repeating those checks.
- Boil gravity accounts for batch volume, boil time, and boil-off. Whirlpool utilization is an estimate of 25% of equivalent boil utilization; dry hops contribute no Tinseth IBU. Alpha decay is an explicit simplified estimate of 5% per stored month, not a hop-storage-index model.
- Water additions assume gypsum and calcium chloride **dihydrate**, distributed over the target batch volume. Source Ca/SO4/Cl are editable. The app does not calculate mash pH or water alkalinity.
- The SRM swatch is approximate. Fermentation and brewhouse results require real measurements.
- BeerXML and Brewfather JSON export recipes for import; native BrewLab.ai JSON supports round-trip imports. Hardware control and direct recipe push are not implemented.

## Cloudflare Deployment

Deploy this full-stack Next.js application to **Cloudflare Workers**, not a static Cloudflare Pages project. OpenNext runs its server routes and D1 bindings on Workers.

Create a D1 database:

```sh
npx wrangler d1 create brew-lab
```

Replace the placeholder `database_id` in [wrangler.jsonc](wrangler.jsonc) with the returned ID, keeping the binding named `DB`. Apply the production schema:

```sh
npm run db:migrate:remote
```

Configure Worker secrets (Wrangler prompts for each value):

```sh
npx wrangler secret put BETTER_AUTH_URL
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put CREDENTIAL_ENCRYPTION_KEY
```

Use the production HTTPS origin for `BETTER_AUTH_URL`, a separate random production secret for `BETTER_AUTH_SECRET`, and the Google web-client credentials. Generate another independent 32-byte base64 key for `CREDENTIAL_ENCRYPTION_KEY`. Add the production callback URI in Google Cloud Console. Optional supplier feeds use this secret:

```sh
npx wrangler secret put STOCKIST_FEEDS
npm run deploy
```

The OpenNext adapter emits `.open-next/worker.js` and `.open-next/assets`. The configuration enables `nodejs_compat`, binds static assets and D1, and initializes local D1 bindings for `next dev`. Routes use the Workers Node compatibility runtime; do not add Next's `runtime = 'edge'` to these routes.

For local Worker preview, set the same local credentials in a gitignored `.dev.vars` file, run `npm run db:migrate:local`, then `npm run preview`. Use the preview origin for `BETTER_AUTH_URL` and register its Google callback URI as well. `next dev` reads `.env.local`; Wrangler preview reads `.dev.vars`.

Only set optional secrets you need. A Cloudflare account and Wrangler authentication are required for remote database creation and deployment. No credentials, Google provider settings, or production database have been provisioned automatically.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run cf:build
```

Tests cover brewing calculations, single-supplier selection, API origin/body boundaries, Brewfather v1/v2 pagination, auth configuration/session gating, credential encryption and tamper detection, provider selection, profile API protections, and real D1 account isolation and concurrent quotas using Wrangler's local emulator. Live Google OAuth, AI providers, Brewfather, and supplier feeds require configured credentials. `npm audit` reports dependency advisories; review these before production release rather than forcing framework downgrades.
