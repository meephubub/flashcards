/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  output: 'standalone',
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias['sharp'] = false;
    }

    if (isServer) {
      config.module.rules.push({
        test: /\.pdf$/,
        loader: 'ignore-loader',
      });
      config.module.rules.push({
        test: /test\/.*/,
        loader: 'ignore-loader',
      });
      // Mark pdf-parse as external for server build
      config.externals.push('pdf-parse');
    }
    return config;
  },
}

export default nextConfig