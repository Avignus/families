const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // ISO A.14.2.1 — restricts resource origins; blocks clickjacking and third-party script injection.
    // unsafe-inline/unsafe-eval are required by Next.js App Router hydration scripts.
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.steamstatic.com https://store.steampowered.com https://*.public.blob.vercel-storage.com",
      "font-src 'self'",
      "connect-src 'self' https://steamcommunity.com https://api.steampowered.com https://*.sentry.io https://*.ingest.sentry.io",
      "frame-src https://my.spline.design",
      "frame-ancestors 'none'",
      "form-action 'self' https://steamcommunity.com",
      "base-uri 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.steamstatic.com" },
      { protocol: "https", hostname: "cdn.akamai.steamstatic.com" },
      { protocol: "https", hostname: "store.steampowered.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "families.im"],
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,          // sem output no build
  disableLogger: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,  // não expõe source maps no bundle do cliente
});
