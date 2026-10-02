import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __afifPg: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for database access");
  return postgres(url, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {
      /* keep the dev console quiet */
    },
  });
}

// Reuse one pool across hot reloads in development.
const client = globalThis.__afifPg ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__afifPg = client;

export const db = drizzle(client, { schema });
export type Database = typeof db;
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function closeDb(): Promise<void> {
  await client.end({ timeout: 5 });
  globalThis.__afifPg = undefined;
}

export { schema };
