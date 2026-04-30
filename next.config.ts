import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  : '*.supabase.co';

const cspDirectives = [
  "default-src 'self'",
  // 'unsafe-inline' required by Next.js runtime + Sentry; 'unsafe-eval' only in dev
  `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ''} https://*.sentry.io`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
  `img-src 'self' data: blob: https://i.pravatar.cc https://images.unsplash.com https://randomuser.me https://unpkg.com https://*.tile.openstreetmap.org https://${supabaseHost}`,
  `font-src 'self' https://fonts.gstatic.com`,
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://*.sentry.io https://nominatim.openstreetmap.org`,
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
];

const securityHeaders = [
  { key: 'Content-Security-Policy', value: cspDirectives.join('; ') },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
    ];
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'recharts',
      '@supabase/supabase-js',
      '@supabase/ssr',
      'sonner',
    ],
  },
  reactCompiler: true,

  turbopack: {
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js'],
  },

  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'randomuser.me',
      }
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // Read from SENTRY_ORG / SENTRY_PROJECT env vars at build time
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Suppress Sentry build output unless in CI
  silent: !process.env.CI,

  // Only upload source maps when DSN is configured (avoids warnings in local dev)
  sourcemaps: {
    disable: !process.env.SENTRY_DSN,
    deleteSourcemapsAfterUpload: true,
  },

  // Include Next.js and dependency code in uploaded source maps
  widenClientFileUpload: true,

  // Auto-instrument — keep defaults (all true)
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,
  autoInstrumentAppDirectory: true,

  // Create Vercel Cron monitors in Sentry when fully configured
  automaticVercelMonitors: !!process.env.SENTRY_DSN,

  // Swallow source map upload errors gracefully (don't break CI)
  errorHandler: (err) => {
    // Log but don't throw — source map upload failure should not fail the build
    process.stderr.write(`[Sentry] Source map upload error: ${err.message}\n`);
  },
});
