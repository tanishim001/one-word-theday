# Deploy Checklist

## 1. Create a Postgres database

Use Neon, Supabase, or another hosted Postgres provider. For Vercel/serverless deployment,
prefer a pooled connection string when the provider offers one.

For Neon, choose the connection string intended for pooled/serverless access.

## 2. Configure local env

Create `.env.local` in the project root:

```env
DATABASE_URL="postgres://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
```

`DATABASE_URL` is preferred. `POSTGRES_URL` also works if your provider injects it.

Then run:

```bash
npm run db:check
```

This creates the tables if needed and upserts the seed words.

## 3. Verify locally against Postgres

Run:

```bash
npm run dev
```

Open `http://localhost:3000` and vote once. The app uses Postgres whenever
`DATABASE_URL` is set.

You can also check:

```text
http://localhost:3000/api/health/db
```

It should return `"database":"postgres"` when `DATABASE_URL` or `POSTGRES_URL` is loaded.

## 4. Deploy on Vercel

1. Push the project to GitHub.
2. Import the repository in Vercel.
3. Add `DATABASE_URL` in Project Settings > Environment Variables, or connect a Vercel Marketplace Postgres integration that injects `POSTGRES_URL`.
4. Deploy.
5. Open `/api/health/db` on the deployment URL and confirm `"database":"postgres"`.
6. Open the site and confirm words load and votes persist.

## Notes

- `data/words.db` is only for local fallback when `DATABASE_URL` is not set.
- Production should use Postgres, not the local SQLite file.
- Seed word text updates are applied automatically. Existing vote counts are preserved.
