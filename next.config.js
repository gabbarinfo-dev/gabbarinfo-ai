/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: '/webhooks/:path*',
        destination: '/api/webhooks/:path*',
      },
      {
        source: '/webhooks',
        destination: '/api/webhooks',
      },
    ];
  },
};

module.exports = nextConfig;
