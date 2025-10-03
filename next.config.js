/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // experimental.appDir is now the default in Next.js 14.x
  images: {
    domains: ['images.unsplash.com'],
  },
};

module.exports = nextConfig;
