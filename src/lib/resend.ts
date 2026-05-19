import { Resend } from 'resend';

let _client: Resend | null = null;

export function getResend(): Resend {
    if (!_client) {
        const key = process.env.RESEND_API_KEY;
        if (!key) throw new Error('RESEND_API_KEY not configured');
        _client = new Resend(key);
    }
    return _client;
}

// Legacy export kept for backward compat — throws at call time, not module load
export const resend = new Proxy({} as Resend, {
    get(_target, prop) {
        return (getResend() as unknown as Record<string | symbol, unknown>)[prop];
    },
});
