import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    const backend = (process.env.BACKEND_UPSTREAM || process.env.NEXT_PUBLIC_API_BASE_URL || "https://medihubbackend-production.up.railway.app").replace(/\/$/, "");
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
