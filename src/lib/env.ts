import { z } from 'zod';

const envSchema = z.object({
    // Supabase
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),

    // Resend
    RESEND_API_KEY: z.string().min(1).optional(), // Optional for now if not strictly required

    // Webhooks (Critical for detailed flows — optional at module init, validated inside each action)
    WEBHOOK_API_KEY: z.string().min(1).optional(),
    OCR_WEBHOOK_URL: z.string().url().optional(),
    COMPARISON_WEBHOOK_URL: z.string().url().optional(),

    // Timeouts
    N8N_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

    // Web Push VAPID
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
    VAPID_PRIVATE_KEY: z.string().min(1).optional(),
    VAPID_SUBJECT: z.string().min(1).optional(),

    // PII encryption (AES-256-GCM key + HMAC-SHA-256 blind-index pepper).
    // Required in production; optional in dev/test so the app still boots without
    // keys (any call into src/lib/crypto/pii.ts will throw at use time if missing).
    // Generate with: `node scripts/generate-encryption-keys.mjs`
    APP_ENCRYPTION_KEY: z.string().min(1).optional(),
    APP_ENCRYPTION_PEPPER: z.string().min(1).optional(),

    // CNMC SIPS API OAuth 1.0a credentials. Server-side only.
    CNMC_OAUTH_CONSUMER_KEY: z.string().min(1).optional(),
    CNMC_OAUTH_CONSUMER_SECRET: z.string().min(1).optional(),
    CNMC_OAUTH_TOKEN: z.string().min(1).optional(),
    CNMC_OAUTH_TOKEN_SECRET: z.string().min(1).optional(),

    // Sentry (optional — if not set, error tracking is disabled in dev)
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),

    // Node Environment
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
}).superRefine((data, ctx) => {
    // Hard requirement in production: refuse to boot without PII encryption keys.
    if (data.NODE_ENV === 'production') {
        if (!data.APP_ENCRYPTION_KEY) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['APP_ENCRYPTION_KEY'],
                message: 'APP_ENCRYPTION_KEY is required in production. Generate with `node scripts/generate-encryption-keys.mjs`.',
            });
        }
        if (!data.APP_ENCRYPTION_PEPPER) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['APP_ENCRYPTION_PEPPER'],
                message: 'APP_ENCRYPTION_PEPPER is required in production. Generate with `node scripts/generate-encryption-keys.mjs`.',
            });
        }
    }
});

const getEnv = () => {
    // Only validate ensuring we are on the server for private variables
    // For client variables (starting with NEXT_PUBLIC_), they are bundled at build time
    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
        const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || process.env.CI === 'true';

        if (isBuildTime) {
            console.warn('⚠️ Missing environment variables during build/CI. This is allowed if they are set in the runtime environment.');
            return process.env as Record<string, string | undefined>;
        }

        console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 4));
        throw new Error('Invalid environment variables');
    }

    return parsed.data;
};

export const env = getEnv();
