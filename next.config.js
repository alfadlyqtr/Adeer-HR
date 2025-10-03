/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // experimental.appDir is now the default in Next.js 14.x
  images: {
    domains: [
      'images.unsplash.com',
      'kcpmepkqyqlvuxouudqy.supabase.co', // Supabase Storage public URLs
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
};

module.exports = nextConfig;
