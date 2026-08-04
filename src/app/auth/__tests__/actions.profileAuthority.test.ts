import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    createClientMock,
    loggerErrorMock,
    loggerWarnMock,
    revalidatePathMock,
    redirectMock,
} = vi.hoisted(() => ({
    createClientMock: vi.fn(),
    loggerErrorMock: vi.fn(),
    loggerWarnMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    redirectMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/logger', () => ({
    logger: { error: loggerErrorMock, warn: loggerWarnMock },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('next/navigation', () => ({ redirect: redirectMock }));

import { login } from '../actions';
import { SAFE_LOGIN_ERROR } from '@/lib/auth/safeLoginError';

function formData() {
    const input = new FormData();
    input.set('email', 'persona.privada@example.test');
    input.set('password', 'not-a-real-password');
    return input;
}

describe('login privacy boundary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns one generic error and omits provider details when sign-in is rejected', async () => {
        createClientMock.mockResolvedValue({
            auth: {
                signInWithPassword: vi.fn().mockResolvedValue({
                    error: { message: 'User persona.privada@example.test is blocked', status: 400 },
                }),
            },
        });

        await expect(login(formData())).resolves.toEqual({ error: SAFE_LOGIN_ERROR });
        expect(loggerWarnMock).toHaveBeenCalledWith(
            { safeCode: 'invalid_credentials_or_provider_failure' },
            '[auth] sign-in rejected',
        );
        expect(loggerWarnMock).not.toHaveBeenCalledWith(expect.anything(), expect.stringContaining('persona.privada'));
        expect(revalidatePathMock).not.toHaveBeenCalled();
        expect(redirectMock).not.toHaveBeenCalled();
    });

    it('does not forward an unexpected provider error to the browser or logger', async () => {
        createClientMock.mockRejectedValue(new Error('failed for persona.privada@example.test'));

        await expect(login(formData())).resolves.toEqual({ error: SAFE_LOGIN_ERROR });
        expect(loggerErrorMock).toHaveBeenCalledWith(
            { safeCode: 'sign_in_unexpected' },
            '[auth] sign-in failed',
        );
        expect(loggerErrorMock).not.toHaveBeenCalledWith(expect.anything(), expect.any(Error));
    });
});
