import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const here = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The sandbox preview proxies this app under an *.e2b.app host; keep the dev
  // server permissive about origins but never echo arbitrary hosts back.
  allowedDevOrigins: ["*.e2b.app", "localhost", "127.0.0.1"],
  // This app lives in a subdirectory of a larger repository, so pin the root
  // here instead of letting the packager walk up to the parent lockfile.
  turbopack: { root: here },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
