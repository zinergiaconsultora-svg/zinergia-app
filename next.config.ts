import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

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

  typescript: {
    ignoreBuildErrors: true,
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
