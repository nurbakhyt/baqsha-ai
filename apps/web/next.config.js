/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@baqsha/shared"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path((?!copilotkit).*)",
        destination: "http://localhost:8787/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;