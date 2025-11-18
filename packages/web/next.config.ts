import type { NextConfig } from 'next'
import createMDX from '@next/mdx'

const IS_PROD = process.env.NODE_ENV !== 'development'

const nextConfig: NextConfig = {
  output: IS_PROD ? 'export' : 'standalone',
  distDir: 'dist',
  // Configure pageExtensions to include markdown and MDX files
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: (process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL : 'http://127.0.0.1:3001') + '/:path*',
      },
    ]
  },
}

const withMDX = createMDX({
  // For Turbopack compatibility, use plugin names as strings
  options: {
    remarkPlugins: [
      // Use string plugin names for Turbopack compatibility
      'remark-gfm',
    ],
    rehypePlugins: [],
  },
  // Handle both .md and .mdx files
  extension: /\.(md|mdx)$/,
})

// Merge MDX config with Next.js config
export default withMDX(nextConfig)
