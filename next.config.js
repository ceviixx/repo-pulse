/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  basePath: process.env.NODE_ENV === 'production' ? '/repo-pulse' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/repo-pulse/' : '',
}

module.exports = nextConfig
