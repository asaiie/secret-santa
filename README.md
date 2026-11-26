# Secret Santa

SvelteKit (static) frontend + a Cloudflare Worker API, with Cloudflare D1 for storage.

- `src/` — the site (prerendered to `build/`)
- `worker/index.ts` — `/api/*` routes; everything else is served from `build/`
- `migrations/` — D1 schema
- `src/lib/names.ts` — the 12 names and the organizer (`ADMIN`)

## Local development

```sh
npm install
npm run db:migrate:local   # once: create local tables
npm run dev:api            # Worker + local D1 on :8787 (serves the last build)
npm run dev                # Vite dev server with hot reload; proxies /api to :8787
```

`.dev.vars` holds a dev-only `SESSION_SECRET` and is gitignored.

## First deploy

```sh
npx wrangler d1 create secret-santa        # paste the printed database_id into wrangler.jsonc
npm run db:migrate:remote
openssl rand -base64 32 | npx wrangler secret put SESSION_SECRET
npm run deploy
```

## Database chores

```sh
# Peek at the draw
npx wrangler d1 execute secret-santa --remote --command "SELECT * FROM assignments"
# Reset someone's password (they'll be asked to pick a new one)
npx wrangler d1 execute secret-santa --remote --command "DELETE FROM users WHERE name = 'John'"
# Undo the draw
npx wrangler d1 execute secret-santa --remote --command "DELETE FROM assignments"
```
