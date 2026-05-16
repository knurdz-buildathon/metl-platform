import type { NextConfig } from "next";

const INTERNAL_VAULT_URL = process.env.INTERNAL_VAULT_URL || "http://simple-vault:3002";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",

  // Proxy API calls to control-plane on the same domain
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: "http://control-plane:3001/api/:path*",
        },
      ],
      afterFiles: [
        {
          source: "/vault",
          destination: `${INTERNAL_VAULT_URL}/vault`,
        },
        {
          source: "/vault/:path*",
          destination: `${INTERNAL_VAULT_URL}/vault/:path*`,
        },
      ],
    };
  },

  images: {
    remotePatterns: [
      { hostname: "metl.run" },
      { hostname: "*.metl.run" },
    ],
  },
};

export default nextConfig;
