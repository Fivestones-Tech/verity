import type { NextConfig } from "next";

// Cache Components is left off on purpose: every Verity screen is signed-in and
// per-user, so there is little to cache, and fully dynamic rendering is simpler
// to reason about for security. Revisit when Next.js makes it the default.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // question/student spreadsheets are uploaded through server actions
    serverActions: { bodySizeLimit: "4mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
