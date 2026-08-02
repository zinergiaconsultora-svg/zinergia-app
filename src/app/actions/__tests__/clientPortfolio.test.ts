import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireServerRoleMock = vi.fn();
const createClientMock = vi.fn();

vi.mock('@/lib/auth/permissions', () => ({
    requireServerRole: requireServerRoleMock,
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }));
vi.mock('@/lib/drive/purgeClientDriveFiles', () => ({ purgeClientDriveFiles: vi.fn() }));
vi.mock('@/lib/audit/leadAuditLog', () => ({ writeLeadAuditEvent: vi.fn() }));
vi.mock('@/lib/crypto/clientPii', () => ({
    buildClientPiiColumns: vi.fn(),
    hydrateClientRow: vi.fn(),
    hydrateClientRows: vi.fn(),
}));
vi.mock('@/lib/crypto/pii', () => ({ hashCups: vi.fn(), hashDni: vi.fn() }));

describe('client portfolio reads', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireServerRoleMock.mockResolvedValue(undefined);
    });

    it('authorizes before opening the portfolio database session', async () => {
        requireServerRoleMock.mockRejectedValue(new Error('Forbidden'));
        const { getClientPortfolioAction } = await import('../clients');

        await expect(getClientPortfolioAction()).rejects.toThrow('Forbidden');
        expect(createClientMock).not.toHaveBeenCalled();
    });

    it('rejects an invalid relationship id before opening a database session', async () => {
        const { getClientRelationshipAction } = await import('../clients');

        await expect(getClientRelationshipAction('invalid')).resolves.toBeNull();
        expect(requireServerRoleMock).toHaveBeenCalledWith(['admin', 'franchise', 'agent']);
        expect(createClientMock).not.toHaveBeenCalled();
    });
});
