'use server';

/**
 * Client CRUD server actions with application-layer PII encryption.
 *
 * These exist because CUPS / DNI must be encrypted with a server-only key:
 * the previous browser-side `clientService` could not encrypt on write nor
 * decrypt on read. Every path that creates, updates or loads a client with
 * PII now goes through here so the ciphertext columns are the source of truth.
 *
 * RLS still applies: we use the cookie-based session client, so an agent only
 * ever sees / writes clients within their own franchise.
 */

import { createClient } from '@/lib/supabase/server';
import { requireServerRole } from '@/lib/auth/permissions';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Client } from '@/types/crm';
import {
    buildClientPiiColumns,
    hydrateClientRow,
    hydrateClientRows,
    type ClientPiiRow,
} from '@/lib/crypto/clientPii';
import { hashCups, hashDni } from '@/lib/crypto/pii';
import { moduleLogger } from '@/lib/logger';

const log = moduleLogger('clients-action');

const CLIENT_TYPES = ['residential', 'company', 'public_admin', 'particular'] as const;
const CLIENT_STATUSES = ['new', 'contacted', 'in_process', 'won', 'lost'] as const;

// Fields a caller is allowed to set. PII (cups/dni_cif) is handled separately
// through buildClientPiiColumns — never written as plaintext.
const clientInputSchema = z.object({
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
    email: z.string().trim().email().max(200).optional().or(z.literal('')),
    phone: z.string().trim().max(50).optional().or(z.literal('')),
    address: z.string().trim().max(300).optional().or(z.literal('')),
    cups: z.string().trim().max(60).optional().or(z.literal('')),
    dni_cif: z.string().trim().max(40).optional().or(z.literal('')),
    type: z.enum(CLIENT_TYPES).optional(),
    status: z.enum(CLIENT_STATUSES).optional(),
    current_supplier: z.string().trim().max(120).optional().or(z.literal('')),
    tariff_type: z.string().trim().max(40).optional().or(z.literal('')),
    average_monthly_bill: z.number().nonnegative().optional().nullable(),
    city: z.string().trim().max(120).optional().or(z.literal('')),
    zip_code: z.string().trim().max(10).optional().or(z.literal('')),
});

export type ClientInput = z.infer<typeof clientInputSchema>;

const PAGE_SIZE_MAX = 200;

async function getSessionContext() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');
    const { data: profile } = await supabase
        .from('profiles')
        .select('franchise_id')
        .eq('id', user.id)
        .single();
    const franchiseId = profile?.franchise_id ?? null;
    return { supabase, userId: user.id, franchiseId };
}

/**
 * Load a page of clients for the current franchise, with CUPS / DNI decrypted.
 * Mirrors the previous clientService.getClients ordering and paging.
 */
export async function getClientsAction(limit = 20, offset = 0): Promise<Client[]> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const safeLimit = Math.min(Math.max(1, limit), PAGE_SIZE_MAX);
    const safeOffset = Math.max(0, offset);

    const { supabase, franchiseId } = await getSessionContext();
    if (!franchiseId) return [];

    const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('franchise_id', franchiseId)
        .order('created_at', { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1);

    if (error) throw new Error(`Error cargando clientes: ${error.message}`);
    return hydrateClientRows((data ?? []) as ClientPiiRow[]) as unknown as Client[];
}

/** Load a single client by id, with CUPS / DNI decrypted. */
export async function getClientByIdAction(id: string): Promise<Client | null> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    if (!z.uuid().safeParse(id).success) throw new Error('ID de cliente inválido');

    const { supabase } = await getSessionContext();
    const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) throw new Error(`Error cargando cliente: ${error.message}`);
    if (!data) return null;
    return hydrateClientRow(data as ClientPiiRow) as unknown as Client;
}

/** Create a client, encrypting CUPS / DNI server-side. */
export async function createClientAction(input: ClientInput): Promise<Client> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const parsed = clientInputSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    const clean = parsed.data;

    const { supabase, userId, franchiseId } = await getSessionContext();
    if (!franchiseId) throw new Error('No se encontró la franquicia del agente');

    const pii = buildClientPiiColumns({ cups: clean.cups, dni_cif: clean.dni_cif });

    const { data, error } = await supabase
        .from('clients')
        .insert({
            name: clean.name,
            email: clean.email || null,
            phone: clean.phone || null,
            address: clean.address || null,
            type: clean.type ?? 'particular',
            status: clean.status ?? 'new',
            current_supplier: clean.current_supplier || null,
            tariff_type: clean.tariff_type || null,
            average_monthly_bill: clean.average_monthly_bill ?? null,
            city: clean.city || null,
            zip_code: clean.zip_code || null,
            franchise_id: franchiseId,
            owner_id: userId,
            ...pii,
        })
        .select('*')
        .single();

    if (error) throw new Error(`Error creando cliente: ${error.message}`);

    logClientActivity(supabase, {
        clientId: (data as { id: string }).id,
        agentId: userId,
        franchiseId,
        type: 'client_created',
        description: `Cliente "${clean.name}" creado`,
    });

    revalidatePath('/dashboard/clients');
    revalidatePath('/dashboard');
    return hydrateClientRow(data as ClientPiiRow) as unknown as Client;
}

/** Update a client, re-encrypting CUPS / DNI when those fields are provided. */
export async function updateClientAction(id: string, updates: Partial<ClientInput>): Promise<Client> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    if (!z.uuid().safeParse(id).success) throw new Error('ID de cliente inválido');

    const parsed = clientInputSchema.partial().safeParse(updates);
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    const clean = parsed.data;

    const { supabase, userId, franchiseId } = await getSessionContext();

    // Build the update payload from the non-PII allowlist only.
    const payload: Record<string, unknown> = {};
    if (clean.name !== undefined) payload.name = clean.name;
    if (clean.email !== undefined) payload.email = clean.email || null;
    if (clean.phone !== undefined) payload.phone = clean.phone || null;
    if (clean.address !== undefined) payload.address = clean.address || null;
    if (clean.type !== undefined) payload.type = clean.type;
    if (clean.status !== undefined) payload.status = clean.status;
    if (clean.current_supplier !== undefined) payload.current_supplier = clean.current_supplier || null;
    if (clean.tariff_type !== undefined) payload.tariff_type = clean.tariff_type || null;
    if (clean.average_monthly_bill !== undefined) payload.average_monthly_bill = clean.average_monthly_bill ?? null;
    if (clean.city !== undefined) payload.city = clean.city || null;
    if (clean.zip_code !== undefined) payload.zip_code = clean.zip_code || null;

    // Re-encrypt PII only for the fields actually provided.
    if (clean.cups !== undefined || clean.dni_cif !== undefined) {
        const pii = buildClientPiiColumns({ cups: clean.cups, dni_cif: clean.dni_cif });
        if (clean.cups !== undefined) {
            payload.cups_ciphertext = pii.cups_ciphertext;
            payload.cups_hash = pii.cups_hash;
        }
        if (clean.dni_cif !== undefined) {
            payload.dni_cif_ciphertext = pii.dni_cif_ciphertext;
            payload.dni_cif_hash = pii.dni_cif_hash;
        }
    }

    const { data, error } = await supabase
        .from('clients')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

    if (error) throw new Error(`Error actualizando cliente: ${error.message}`);

    if (clean.status && clean.status !== 'new') {
        logClientActivity(supabase, {
            clientId: id,
            agentId: userId,
            franchiseId,
            type: 'client_status_changed',
            description: `Estado cambiado a "${clean.status}"`,
            metadata: { new_status: clean.status },
        });
    }

    revalidatePath('/dashboard/clients');
    revalidatePath(`/dashboard/clients/${id}`);
    revalidatePath('/dashboard');
    return hydrateClientRow(data as ClientPiiRow) as unknown as Client;
}

const resolveClientSchema = z.object({
    client_id: z.uuid().optional().nullable(),
    cups: z.string().trim().max(60).optional().nullable(),
    dni_cif: z.string().trim().max(40).optional().nullable(),
    name: z.string().trim().max(200).optional().nullable(),
    address: z.string().trim().max(300).optional().nullable(),
});

export type ResolveClientInput = z.infer<typeof resolveClientSchema>;

/**
 * Resolve a client for a simulation: explicit id → dedup by CUPS hash →
 * dedup by DNI hash → create (encrypted). Returns the client id.
 *
 * Replaces the previous browser-side client creation in logSimulation, which
 * could neither encrypt the PII nor dedup against the blind-index hashes.
 */
export async function resolveOrCreateClientAction(input: ResolveClientInput): Promise<string> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const parsed = resolveClientSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    const clean = parsed.data;

    const { supabase, userId, franchiseId } = await getSessionContext();
    if (!franchiseId) throw new Error('No se encontró la franquicia del agente');

    if (clean.client_id) return clean.client_id;

    // Dedup by CUPS blind index, then DNI blind index.
    if (clean.cups?.trim()) {
        const { data } = await supabase
            .from('clients')
            .select('id')
            .eq('franchise_id', franchiseId)
            .eq('cups_hash', hashCups(clean.cups))
            .maybeSingle();
        if (data?.id) return data.id;
    }
    if (clean.dni_cif?.trim()) {
        const { data } = await supabase
            .from('clients')
            .select('id')
            .eq('franchise_id', franchiseId)
            .eq('dni_cif_hash', hashDni(clean.dni_cif))
            .maybeSingle();
        if (data?.id) return data.id;
    }

    const pii = buildClientPiiColumns({ cups: clean.cups, dni_cif: clean.dni_cif });
    const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
            name: clean.name || 'Nuevo Cliente',
            franchise_id: franchiseId,
            owner_id: userId,
            type: 'residential',
            status: 'new',
            address: clean.address || null,
            ...pii,
        })
        .select('id')
        .single();

    if (error) throw new Error(`Error creando cliente: ${error.message}`);
    return (newClient as { id: string }).id;
}

// ---------------------------------------------------------------------------
// Best-effort activity logging (mirrors the previous clientService behavior).
// ---------------------------------------------------------------------------

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

function logClientActivity(
    supabase: SupabaseLike,
    args: {
        clientId: string;
        agentId: string;
        franchiseId: string | null;
        type: string;
        description: string;
        metadata?: Record<string, unknown>;
    },
): void {
    supabase
        .from('client_activities')
        .insert({
            client_id: args.clientId,
            agent_id: args.agentId,
            franchise_id: args.franchiseId,
            type: args.type,
            description: args.description,
            metadata: args.metadata ?? {},
        })
        .then(({ error }: { error: unknown }) => {
            if (error) log.warn({ type: args.type }, 'client activity log failed (non-blocking)');
        });
}
