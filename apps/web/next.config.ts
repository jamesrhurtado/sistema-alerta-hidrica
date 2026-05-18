import type { NextConfig } from "next";

const config: NextConfig = {
  typedRoutes: true,
  async rewrites() {
    const apiUrl = process.env.API_URL ?? "http://localhost:8000";
    return [
      { source: "/api/:path*", destination: `${apiUrl}/:path*` },
    ];
  },
};

export default config;
