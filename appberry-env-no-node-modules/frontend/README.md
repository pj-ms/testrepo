## D1

### Migrations

Generate migrations by modifying `project/appberry-env/backend/src/db/schema.ts`, and then running `pnpm drizzle-kit generate`.

To apply migrations to the local DB, run `pnpm wrangler d1 migrations apply REPLACEME_D1_DB_NAME --local`.
