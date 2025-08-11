import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Vercel deployment settings
  output: 'standalone',
  // Environment-specific configurations
  publicRuntimeConfig: {
    // Will be available on both server and client
    IS_PRODUCTION: process.env.NODE_ENV === 'production',
    IS_VERCEL: process.env.VERCEL === '1',
  },
  serverRuntimeConfig: {
    // Will only be available on the server side
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  // Build optimizations for production
  compress: true,
  poweredByHeader: false,
  // Image optimization
  images: {
    domains: ['localhost', 'vercel.app', 'supabase.co'],
    formats: ['image/webp', 'image/avif'],
  },
  // Headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  // Redirects for production
  async redirects() {
    if (process.env.NODE_ENV === 'production') {
      return [
        {
          source: '/admin',
          destination: '/admin/dashboard',
          permanent: false,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
