'use server';

import { createClient } from '@/lib/supabase/server';
import { requireServerRole } from '@/lib/auth/permissions';
import { revalidatePath } from 'next/cache';
import type { ClientStatus, ClientType } from '@/types/crm';
import { z } from 'zod';
import { encryptNullable, hashCups, hashDni } from '@/lib/crypto/pii';

const CLIENT_STATUSES = ['new', 'contacted', 'in_process', 'won', 'lost'] as const;

const bulkIdsSchema = z.array(z.uuid()).min(1, 'Se requiere al menos un cliente');
const clientStatusSchema = z.enum(CLIENT_STATUSES);

export async function updateClientStatusBulk(
    clientIds: string[],
    newStatus: ClientStatus
): Promise<{ updated: number }> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const idsResult = bulkIdsSchema.safeParse(clientIds);
    if (!idsResult.success) throw new Error(`IDs inválidos: ${idsResult.error.issues[0].message}`);
    const statusResult = clientStatusSchema.safeParse(newStatus);
    if (!statusResult.success) throw new Error(`Estado inválido: ${newStatus}`);

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('clients')
        .update({ status: statusResult.data })
        .in('id', idsResult.data)
        .select('id');

    if (error) throw new Error(`Error actualizando clientes: ${error.message}`);
    revalidatePath('/dashboard/clients');
    revalidatePath('/dashboard');
    return { updated: data?.length ?? 0 };
}

export async function updateClientStatus(
    clientId: string,
    newStatus: ClientStatus
): Promise<void> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const idResult = z.uuid().safeParse(clientId);
    if (!idResult.success) throw new Error(`ID de cliente inválido`);
    const statusResult = clientStatusSchema.safeParse(newStatus);
    if (!statusResult.success) throw new Error(`Estado inválido: ${newStatus}`);

    const supabase = await createClient();

    const { error } = await supabase
        .from('clients')
        .update({ status: statusResult.data })
        .eq('id', idResult.data);

    if (error) throw new Error(`Error actualizando cliente: ${error.message}`);
    revalidatePath('/dashboard/clients');
    revalidatePath(`/dashboard/clients/${idResult.data}`);
    revalidatePath('/dashboard');
}

export async function deleteClientsBulk(clientIds: string[]): Promise<{ deleted: number }> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const idsResult = bulkIdsSchema.safeParse(clientIds);
    if (!idsResult.success) throw new Error(`IDs inválidos: ${idsResult.error.issues[0].message}`);

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('clients')
        .delete()
        .in('id', idsResult.data)
        .select('id');

    if (error) throw new Error(`Error eliminando clientes: ${error.message}`);
    revalidatePath('/dashboard/clients');
    revalidatePath('/dashboard');
    return { deleted: data?.length ?? 0 };
}

// ── Importación masiva de clientes desde CSV ──────────────────────────────────

export interface CsvClientRow {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    cups?: string;
    average_monthly_bill?: number;
    current_supplier?: string;
    tariff_type?: string;
    type?: ClientType;
    status?: ClientStatus;
    dni_cif?: string;
    city?: string;
    zip_code?: string;
}

export interface ImportClientsResult {
    inserted: number;
    skipped: number;
    errors: string[];
}

const csvRowSchema = z.object({
    name: z.string().min(1, 'El nombre es obligatorio'),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    phone: z.string().optional(),
    address: z.string().optional(),
    cups: z.string().optional(),
    average_monthly_bill: z.number().nonnegative().optional(),
    current_supplier: z.string().optional(),
    tariff_type: z.string().optional(),
    type: z.enum(['residential', 'company', 'public_admin', 'particular']).optional(),
    status: z.enum(['new', 'contacted', 'in_process', 'won', 'lost']).optional(),
    dni_cif: z.string().optional(),
    city: z.string().optional(),
    zip_code: z.string().optional(),
});

export async function importClientsFromCsvAction(rows: CsvClientRow[]): Promise<ImportClientsResult> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('No hay filas para importar');
    }
    if (rows.length > 500) {
        throw new Error('Máximo 500 clientes por importación');
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    // Get franchise_id from agent profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('franchise_id')
        .eq('id', user.id)
        .single();

    const franchiseId = profile?.franchise_id;
    if (!franchiseId) throw new Error('No se encontró la franquicia del agente');

    // Pre-fetch existing CUPS in this franchise to detect duplicates.
    // Uses the blind-index hash column for equality search (RGPD-safe).
    const candidateCups = rows.map(r => r.cups?.trim().toUpperCase()).filter(Boolean) as string[];
    const existingCups = new Set<string>();
    if (candidateCups.length > 0) {
        const candidateHashes = candidateCups.map(c => hashCups(c));
        const { data: existing } = await supabase
            .from('clients')
            .select('cups, cups_hash')
            .eq('franchise_id', franchiseId)
            .in('cups_hash', candidateHashes);
        (existing ?? []).forEach(r => {
            if (r.cups) existingCups.add(r.cups);
            // Also track via hash in case the plaintext column is already cleared.
            if (r.cups_hash) existingCups.add(r.cups_hash);
        });
    }

    const toInsert: object[] = [];
    const errors: string[] = [];
    let skipped = 0;

    rows.forEach((row, idx) => {
        const rowNum = idx + 2; // 1-based + header row
        const result = csvRowSchema.safeParse(row);
        if (!result.success) {
            errors.push(`Fila ${rowNum} (${row.name ?? '—'}): ${result.error.issues[0].message}`);
            return;
        }
        const clean = result.data;
        const normalizedCups = clean.cups?.trim().toUpperCase() ?? '';
        const cupsHash = normalizedCups ? hashCups(normalizedCups) : null;
        // Dedup check against both plaintext set and hash set.
        if (normalizedCups && (existingCups.has(normalizedCups) || (cupsHash && existingCups.has(cupsHash)))) {
            skipped++;
            return;
        }
        const normalizedDni = clean.dni_cif?.trim() ?? '';
        toInsert.push({
            name: clean.name,
            email: clean.email || null,
            phone: clean.phone || null,
            address: clean.address || null,
            // Plaintext columns kept during dual-write phase.
            cups: normalizedCups || null,
            dni_cif: normalizedDni || null,
            // Encrypted + blind-index columns (RGPD).
            cups_ciphertext: normalizedCups ? encryptNullable(normalizedCups) : null,
            cups_hash: cupsHash,
            dni_cif_ciphertext: normalizedDni ? encryptNullable(normalizedDni) : null,
            dni_cif_hash: normalizedDni ? hashDni(normalizedDni) : null,
            average_monthly_bill: clean.average_monthly_bill ?? null,
            current_supplier: clean.current_supplier || null,
            tariff_type: clean.tariff_type || null,
            type: clean.type ?? 'particular',
            status: clean.status ?? 'new',
            city: clean.city || null,
            zip_code: clean.zip_code || null,
            franchise_id: franchiseId,
            owner_id: user.id,
        });
    });

    let inserted = 0;
    if (toInsert.length > 0) {
        const { data, error } = await supabase
            .from('clients')
            .insert(toInsert)
            .select('id');
        if (error) throw new Error(`Error insertando clientes: ${error.message}`);
        inserted = data?.length ?? 0;
    }

    revalidatePath('/dashboard/clients');
    revalidatePath('/dashboard');
    return { inserted, skipped, errors };
}

// ── Búsqueda de cliente por CUPS ──────────────────────────────────────────────

export interface ClientCupsMatch {
    id: string;
    name: string;
    status: ClientStatus;
    email?: string | null;
}

/**
 * Busca si existe un cliente vinculado a este CUPS en el CRM del agente.
 * Usado en el simulador para ofrecer vinculación automática.
 */
export async function findClientByCups(cups: string): Promise<ClientCupsMatch | null> {
    if (!cups || cups.length < 18) return null;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('clients')
        .select('id, name, status, email')
        .eq('owner_id', user.id)
        .eq('cups_hash', hashCups(cups))
        .maybeSingle();

    if (error || !data) return null;
    return data as ClientCupsMatch;
}
