import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  allowedDevOrigins: ['192.168.2.105'],
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://51.20.123.52:3000/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
