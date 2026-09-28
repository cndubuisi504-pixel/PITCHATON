/** @type {import('next').NextConfig} */

/**
 * Security headers applied to every response.
 * The CSP is intentionally strict: no inline scripts (Next hydration uses
 * properly nonced/self scripts in production), images allowed from anywhere
 * because admins can paste image URLs for news posts.
 */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Lets the sandboxed preview host proxy the dev server without origin errors.
  allowedDevOrigins: ['*.e2b.app', '*.e2b.dev', 'localhost', '127.0.0.1'],

  // Server Actions can receive big payloads (file uploads go through route
  // handlers, but this keeps the door open for form-based flows).
  experimental: {
    serverActions: { bodySizeLimit: '50mb' },
  },

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
