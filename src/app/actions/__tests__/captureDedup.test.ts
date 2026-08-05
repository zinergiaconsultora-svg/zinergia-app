import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock, requireRoleMock, hashCupsMock } = vi.hoisted(() => ({
    createClientMock: vi.fn(),
    requireRoleMock: vi.fn(),
    hashCupsMock: vi.fn((cups: string) => `hash:${cups}`),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/auth/permissions', () => ({ requireServerRole: requireRoleMock }));
vi.mock('@/lib/crypto/pii', () => ({ hashCups: hashCupsMock }));

import { checkDuplicateAction } from '../capture';

/**
 * Devuelve un cliente de Supabase falso que anota con qué columna se filtró cada
 * consulta. El fallo que motivó estos casos no era el resultado de la consulta,
 * era que la consulta no llegaba a hacerse.
 */
function supabaseFalso(opciones: {
    franchiseId: string | null;
    jobEncontrado?: { id: string; extracted_data: unknown } | null;
    clienteEncontrado?: { id: string; name: string } | null;
}) {
    const filtros: Array<{ tabla: string; columna: string; valor: unknown }> = [];
    const tablasConsultadas: string[] = [];

    const constructor = (tabla: string) => {
        const encadenable: Record<string, unknown> = {};
        const eq = vi.fn((columna: string, valor: unknown) => {
            filtros.push({ tabla, columna, valor });
            return encadenable;
        });
        Object.assign(encadenable, {
            eq,
            select: vi.fn(() => encadenable),
            limit: vi.fn(() => encadenable),
            single: vi.fn().mockResolvedValue({ data: { franchise_id: opciones.franchiseId } }),
            maybeSingle: vi.fn().mockResolvedValue({
                data: tabla === 'ocr_jobs'
                    ? (opciones.jobEncontrado ?? null)
                    : (opciones.clienteEncontrado ?? null),
            }),
        });
        return encadenable;
    };

    return {
        cliente: {
            auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usuario-1' } } }) },
            from: vi.fn((tabla: string) => {
                tablasConsultadas.push(tabla);
                return constructor(tabla);
            }),
        },
        filtros,
        tablasConsultadas,
    };
}

beforeEach(() => {
    requireRoleMock.mockResolvedValue(undefined);
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('checkDuplicateAction', () => {
    it('busca dentro de la franquicia cuando el usuario tiene una', async () => {
        const espia = supabaseFalso({ franchiseId: 'fr-1' });
        createClientMock.mockResolvedValue(espia.cliente);

        await checkDuplicateAction('huella-1');

        expect(espia.filtros).toContainEqual({ tabla: 'ocr_jobs', columna: 'franchise_id', valor: 'fr-1' });
    });

    // El administrador no tiene franquicia por diseño: es lo que sostiene su
    // autoridad. Antes eso devolvía "no es duplicado" sin consultar nada, así que
    // la misma factura podía subirse una y otra vez sin que nadie avisara.
    it('sigue comprobando cuando el usuario no tiene franquicia', async () => {
        const espia = supabaseFalso({
            franchiseId: null,
            jobEncontrado: { id: 'job-9', extracted_data: { client_name: 'Cliente Uno' } },
        });
        createClientMock.mockResolvedValue(espia.cliente);

        const resultado = await checkDuplicateAction('huella-1');

        expect(espia.tablasConsultadas).toContain('ocr_jobs');
        expect(espia.filtros).toContainEqual({ tabla: 'ocr_jobs', columna: 'agent_id', valor: 'usuario-1' });
        expect(resultado).toMatchObject({
            isDuplicate: true,
            existingJobId: 'job-9',
            matchType: 'file_hash',
        });
    });

    it('detecta el duplicado por huella del fichero dentro de la franquicia', async () => {
        const espia = supabaseFalso({
            franchiseId: 'fr-1',
            jobEncontrado: { id: 'job-3', extracted_data: { client_name: 'Cliente Dos' } },
        });
        createClientMock.mockResolvedValue(espia.cliente);

        const resultado = await checkDuplicateAction('huella-1');

        expect(resultado).toMatchObject({ isDuplicate: true, existingClientName: 'Cliente Dos' });
    });

    it('avisa cuando el CUPS ya pertenece a un cliente', async () => {
        const espia = supabaseFalso({
            franchiseId: 'fr-1',
            clienteEncontrado: { id: 'cli-1', name: 'Cliente Tres' },
        });
        createClientMock.mockResolvedValue(espia.cliente);

        const resultado = await checkDuplicateAction('huella-1', 'ES0021000000000000AB');

        expect(resultado).toMatchObject({ isDuplicate: true, matchType: 'cups' });
    });

    // Los clientes se agrupan por `owner_id`, no por `agent_id`: filtrar por la
    // columna equivocada no habría encontrado nada y habría pasado por bueno.
    it('busca los clientes del propio usuario cuando no hay franquicia', async () => {
        const espia = supabaseFalso({ franchiseId: null });
        createClientMock.mockResolvedValue(espia.cliente);

        await checkDuplicateAction('huella-1', 'ES0021000000000000AB');

        expect(espia.filtros).toContainEqual({ tabla: 'clients', columna: 'owner_id', valor: 'usuario-1' });
    });

    it('no marca duplicado cuando no encuentra nada', async () => {
        const espia = supabaseFalso({ franchiseId: 'fr-1' });
        createClientMock.mockResolvedValue(espia.cliente);

        await expect(checkDuplicateAction('huella-nueva')).resolves.toEqual({ isDuplicate: false });
    });
});
