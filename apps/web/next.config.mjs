/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  transpilePackages: ['@nustech/shared', 'react-leaflet', 'leaflet'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'https', hostname: 'storage.appnustech.cloud' },
      { protocol: 'http', hostname: 'localhost' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    // recharts dihapus dari sini karena optimizePackageImports bisa break ES module
    // imports di production standalone build
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
