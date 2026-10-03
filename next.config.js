/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: '/google:id.html',
        destination: '/api/google-verify?id=:id',
      },
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
