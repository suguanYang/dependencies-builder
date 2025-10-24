import type { NextConfig } from 'next'

const IS_PROD = process.env.NODE_ENV !== 'development'

const nextConfig: NextConfig = {
  output: IS_PROD ? 'export' : 'standalone',
  distDir: 'dist',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: (process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL : 'http://127.0.0.1:3001') + '/:path*',
      },
    ]
  },
}

export default nextConfig
