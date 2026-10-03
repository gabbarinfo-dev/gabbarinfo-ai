/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: '/google0f508b164a828c08.html',
        destination: '/api/google-verify?id=0f508b164a828c08',
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
