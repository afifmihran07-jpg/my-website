/**
 * Minimal .env loader for standalone scripts (Next.js loads .env automatically
 * for the app itself; `tsx scripts/*` runs outside of it).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function loadEnv(cwd = process.cwd()): void {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(cwd, file);
    if (!existsSync(full)) continue;
    for (const rawLine of readFileSync(full, "utf8").split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}
