import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Origins permitted to invoke Server Actions when the browser's Origin does not
 * match the Host the app actually sees.
 *
 * Next validates Origin against x-forwarded-host on every Server Action and
 * aborts the request with a 500 when they differ. Behind a reverse proxy that
 * does not rewrite the Host — a hosted preview pane, for example — the browser's
 * Origin is the public hostname while the app sees an internal one, so *every*
 * action, including login, fails. `allowedDevOrigins` does not help here: it
 * only applies to `next dev`, not `next start`.
 *
 * Configured from the environment so no deployment hostname is baked in:
 *   SERVER_ACTION_ALLOWED_ORIGINS="*.example.com,app.example.com"
 */
const allowedOrigins = (process.env.SERVER_ACTION_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Dev-server only. Production origins are handled by allowedOrigins below.
  allowedDevOrigins: ["*.e2b.app", "localhost", "127.0.0.1"],
  // This app lives in a subdirectory of a larger repository, so pin the root
  // here instead of letting the packager walk up to the parent lockfile.
  turbopack: { root: here },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
      ...(allowedOrigins.length > 0 ? { allowedOrigins } : {}),
    },
  },
};

export default nextConfig;
