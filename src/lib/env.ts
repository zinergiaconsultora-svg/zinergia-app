import { z } from 'zod';

const envSchema = z
    .object({
        // Supabase
        NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),

        // Resend
        RESEND_API_KEY: z.string().min(1).optional(), // Optional for now if not strictly required

        // Webhooks — opcionales en dev/test, requeridas en producción (ver superRefine abajo)
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
    })
    .superRefine((data, ctx) => {
        // En producción, las envs del pipeline OCR son obligatorias:
        // sin ellas el callback y el disparador a N8N no funcionan y se degrada a "mock"
        // silencioso, que es peor que un arranque fallido con mensaje claro.
        if (data.NODE_ENV === 'production') {
            if (!data.OCR_WEBHOOK_URL) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['OCR_WEBHOOK_URL'],
                    message: 'OCR_WEBHOOK_URL is required in production',
                });
            }
            if (!data.WEBHOOK_API_KEY) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['WEBHOOK_API_KEY'],
                    message: 'WEBHOOK_API_KEY is required in production',
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
