import * as Sentry from '@sentry/nextjs';
import { env } from '@/lib/env';

Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,

    // Capture 10% of traces in production, 100% in dev
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Replay: capture 10% of sessions, 100% of sessions with errors
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
        Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
        }),
    ],

    // Don't send events in development unless DSN is explicitly set
    enabled: env.NODE_ENV === 'production' || !!env.SENTRY_DSN,
});
