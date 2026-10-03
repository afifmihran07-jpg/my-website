/**
 * Applies every pending SQL migration in ./drizzle to the configured database.
 * Idempotent — drizzle tracks applied migrations in `__drizzle_migrations`.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { loadEnv } from "./env-file";

loadEnv();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  const db = drizzle(client);
  console.log(`→ migrating ${url.replace(/:[^:@/]*@/, ":***@")}`);
  await migrate(db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
  const tables = await client`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name`;
  console.log(`✓ migrations applied — ${tables.length} tables present`);
  await client.end({ timeout: 5 });
}

main().catch((error) => {
  console.error("✗ migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
