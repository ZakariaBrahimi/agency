import type { NextConfig } from "next";

// The portal and admin are built as static pages (`out/`) and copied into ../site by
// scripts/sync.mjs, where Vercel serves them next to the existing /api functions.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: false,
  images: { unoptimized: true },
  // the shared schemas live in ../site/assets/js (also used by the API)
  experimental: { externalDir: true },
};

export default nextConfig;
