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

    // Node Environment
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
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
