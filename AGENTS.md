## Cursor Cloud specific instructions

### Overview

**eatfear** is a Next.js 16 (App Router, React 19, Turbopack) single-package app for real-time cryptocurrency and stock market crash monitoring with email alerts. See `README.md` for full architecture details.

### Running the dev server

```bash
pnpm dev          # starts Next.js dev server on port 3000
```

### Build

```bash
pnpm build        # production build (TypeScript errors are ignored via next.config.mjs)
```

### Lint

The `pnpm lint` script references `eslint .`, but ESLint is **not** included in `devDependencies`. The lint command will fail until ESLint is added to the project.

### Environment variables

A `.env.local` file is required with at minimum:

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (server routes) | Supabase service role key |
| `RESEND_API_KEY` | Optional | For email alert delivery |
| `CRON_SECRET` | Optional | For `/api/check-alerts` endpoint auth |

Placeholder values allow the dev server to start, but authentication and database features require real Supabase credentials. The server-side Supabase client (`lib/supabase/server.ts`) returns `null` gracefully when env vars are missing/invalid; the browser client (`lib/supabase/client.ts`) throws.

### Gotchas

- **pnpm build scripts**: `@tailwindcss/oxide` and `sharp` require native build scripts. If pnpm warns about ignored build scripts, run `pnpm rebuild @tailwindcss/oxide sharp` or add `pnpm.onlyBuiltDependencies` to `package.json`.
- **Protected routes**: `/dashboard` and `/profile` redirect to `/auth/login` when not authenticated. The landing page (`/`) works without auth.
- **No automated tests**: The project has no test framework or test files configured.
- **TypeScript version**: The repo pins `typescript: ^5` which resolves to 5.0.2. Next.js 16 recommends >= 5.1.0; this produces a warning but does not block builds.
