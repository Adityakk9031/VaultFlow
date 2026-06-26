/** @type {import('next').NextConfig} */
const nextConfig = {
  // Packages with native bindings must not be bundled by webpack
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', '@qvac/sdk'],
  },
}

module.exports = nextConfig
