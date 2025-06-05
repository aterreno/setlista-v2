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
  // Enable static exports for CloudFront deployment
  output: 'export',
  // App directory is now a default feature in newer Next.js versions
  experimental: {
    // No need to specify appDir as it's now default
  },
  // Since we're exporting to static HTML, we need to define the trailing slash behavior
  trailingSlash: true,
}

export default nextConfig
