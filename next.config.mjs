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
    // Add a rule to ignore PDF files in node_modules during server-side build
    if (isServer) {
      config.module.rules.push({
        test: /\.pdf$/,
        loader: 'ignore-loader',
      });
    }
    return config;
  },
}

export default nextConfig