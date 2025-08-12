import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // No path redirects between /notes and /notes/new
  async redirects() {
    return []
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.module.rules.push({
        test: /\.pdf$/,
        loader: 'ignore-loader',
      })
      config.module.rules.push({
        test: /test\/.*/,
        loader: 'ignore-loader',
      })
      // Mark pdf-parse as external for server build
      if (Array.isArray(config.externals)) {
        config.externals.push('pdf-parse')
      } else if (typeof config.externals === 'function') {
        // Leave as is or handle if externals is a function
      } else {
        config.externals = ['pdf-parse']
      }
    }

    return config
  },
}

export default nextConfig
