import type { NextConfig } from "next";

/**
 * GameToolX Next.js config.
 *
 * Notable choices:
 * - `experimental.staleTimes.static: 0` — Next.js 16 default is `s-maxage=31536000`
 *   which caches pure SSG for 1 year. We use `revalidate=60` per-page instead.
 * - 资源页按 DisplayPolicy 自动注入 canonical + robots（见 需求-v2-资源索引.md §18.1）
 * - metadataBase: 用 process.env.NEXT_PUBLIC_SITE_URL via metadata() in layouts/pages.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    staleTimes: {
      static: 0,
      dynamic: 30,
    },
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;

