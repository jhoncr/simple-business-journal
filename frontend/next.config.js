const path = require("path");
const createNextIntlPlugin = require("next-intl/plugin");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  images: {
    unoptimized: true, // required for static export
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/v0/b/**',
      },
    ],
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/config.ts");
module.exports = withNextIntl(nextConfig);
