/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  transpilePackages: ["@baqsha/shared"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
    ],
    unoptimized: true,
  },
};

module.exports = nextConfig;