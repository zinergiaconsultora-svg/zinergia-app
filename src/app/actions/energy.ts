'use server';

import { createClient } from '@/lib/supabase/server';
import { requireServerRole } from '@/lib/auth/permissions';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { decryptNullable, encryptNullable, hashCups, normalizeCups } from '@/lib/crypto/pii';
import type { ClientEnergyData, MyDayTask, SupplyPoint, SwitchEvent, SwitchReason } from '@/types/energy';
import { computeEnergyStage } from '@/lib/crm/energyStage';
import { hydrateClientRows, type ClientPiiRow } from '@/lib/crypto/clientPii';

type SupplyPointRow = Omit<SupplyPoint, 'cups'> & {
    cups?: string | null;
    cups_ciphertext?: string | null;
};

type EnergyClientRow = ClientPiiRow & {
    id: string;
    name: string;
    phone: string | null;
    current_supplier: string | null;
    average_monthly_bill: number | null;
    last_contact_date: string | null;
    updated_at: string | null;
};

function decryptCups(ciphertext?: string | null, legacyPlaintext?: string | null): string {
    if (ciphertext) {
        try {
            return decryptNullable(ciphertext) ?? '';
        } catch {
            return '';
        }
    }
    return legacyPlaintext ?? '';
}

function hydrateSupplyPoint(row: SupplyPointRow): SupplyPoint {
    const { cups_ciphertext, cups: legacyCups, ...safeRow } = row;
    const cups = decryptCups(cups_ciphertext, legacyCups);
    return { ...safeRow, cups } as SupplyPoint;
}

function getRelatedClient(value: unknown): { name?: string | null; phone?: string | null } {
    if (Array.isArray(value)) {
        const first = value[0];
        return first && typeof first === 'object' ? first as { name?: string | null; phone?: string | null } : {};
    }
    return value && typeof value === 'object' ? value as { name?: string | null; phone?: string | null } : {};
}

async function getSessionContext() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, franchise_id')
        .eq('id', user.id)
        .single();

    if (!profile?.franchise_id) throw new Error('Perfil sin franquicia');
    return { supabase, user, profile };
}

/**
 * Obtiene todos los clientes del agente/franquicia con su etapa energética calculada.
 */
export async function getClientsWithEnergyStageAction(): Promise<ClientEnergyData[]> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const { supabase, profile } = await getSessionContext();

    // Batch queries en paralelo
    const [clientsResult, proposalsResult, contractsResult, altasResult] = await Promise.all([
        supabase
            .from('clients')
            .select('id, name, phone, cups_ciphertext, dni_cif_ciphertext, current_supplier, tariff_type, average_monthly_bill, last_contact_date, updated_at, status, type, owner_id, franchise_id, segment')
            .eq('franchise_id', profile.franchise_id)
            .order('updated_at', { ascending: false }),
        supabase
            .from('proposals')
            .select('id, client_id, status')
            .eq('franchise_id', profile.franchise_id),
        supabase
            .from('contracts')
            .select('id, client_id, status, end_date')
            .eq('franchise_id', profile.franchise_id),
        supabase
            .from('proposals_alta')
            .select('id, client_id, alta_status')
            .eq('franchise_id', profile.franchise_id),
    ]);

    const clients = hydrateClientRows((clientsResult.data ?? []) as EnergyClientRow[]);
    const allProposals = proposalsResult.data || [];
    const allContracts = contractsResult.data || [];
    const allAltas = altasResult.data || [];

    // Indexar propuestas/contratos/altas por client_id
    const proposalsByClient = new Map<string, { status: string }[]>();
    for (const p of allProposals) {
        const list = proposalsByClient.get(p.client_id) ?? [];
        list.push({ status: p.status });
        proposalsByClient.set(p.client_id, list);
    }

    const contractsByClient = new Map<string, { status: string; end_date?: string }[]>();
    for (const c of allContracts) {
        const list = contractsByClient.get(c.client_id) ?? [];
        list.push({ status: c.status, end_date: c.end_date ?? undefined });
        contractsByClient.set(c.client_id, list);
    }

    const altasByClient = new Map<string, { status: string }[]>();
    for (const a of allAltas) {
        if (!a.client_id || !a.alta_status) continue;
        const list = altasByClient.get(a.client_id) ?? [];
        list.push({ status: a.alta_status });
        altasByClient.set(a.client_id, list);
    }

    return clients.map(c => ({
        clientId: c.id,
        clientName: c.name,
        phone: c.phone ?? undefined,
        energyStage: computeEnergyStage({
            proposals: proposalsByClient.get(c.id) ?? [],
            contracts: contractsByClient.get(c.id) ?? [],
            altas: altasByClient.get(c.id) ?? [],
        }),
        cups: c.cups ?? undefined,
        currentSupplier: c.current_supplier ?? undefined,
        averageMonthlyBill: c.average_monthly_bill ?? undefined,
        lastContactDate: c.last_contact_date ?? undefined,
        updatedAt: c.updated_at ?? undefined,
    }));
}

/**
 * Genera la lista de tareas accionables para el panel "Mi Día".
 */
export async function getMyDayAction(): Promise<MyDayTask[]> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const { supabase, profile } = await getSessionContext();

    const now = new Date();
    const tasks: MyDayTask[] = [];

    // 1. Propuestas enviadas >3d sin respuesta (follow-up)
    const { data: staleProposals } = await supabase
        .from('proposals')
        .select('id, client_id, created_at, clients(name, phone)')
        .eq('status', 'sent')
        .eq('franchise_id', profile.franchise_id)
        .order('created_at', { ascending: true });

    if (staleProposals) {
        for (const p of staleProposals) {
            const days = Math.floor((now.getTime() - new Date(p.created_at).getTime()) / 86_400_000);
            if (days >= 3) {
                const client = getRelatedClient(p.clients);
                tasks.push({
                    id: `followup-${p.id}`,
                    type: 'follow_up',
                    priority: days >= 7 ? 'critical' : 'high',
                    client_id: p.client_id,
                    client_name: client.name ?? 'Cliente',
                    phone: client.phone ?? undefined,
                    title: days >= 7
                        ? `Sin respuesta hace ${days} días`
                        : `Seguimiento propuesta (${days}d)`,
                    subtitle: 'Llamar para cerrar la propuesta',
                    cta_label: 'Ver propuesta',
                    cta_href: `/dashboard/proposals/${p.id}`,
                    due_label: `${days}d`,
                    energy_stage: 'propuesta_enviada',
                });
            }
        }
    }

    // 2. Clientes nuevos >7d sin propuesta
    const { data: staleClients } = await supabase
        .from('clients')
        .select('id, name, phone, created_at')
        .eq('status', 'new')
        .eq('franchise_id', profile.franchise_id);

    if (staleClients) {
        for (const c of staleClients) {
            const days = Math.floor((now.getTime() - new Date(c.created_at).getTime()) / 86_400_000);
            if (days >= 7) {
                tasks.push({
                    id: `no-proposal-${c.id}`,
                    type: 'no_proposal',
                    priority: 'medium',
                    client_id: c.id,
                    client_name: c.name,
                    phone: c.phone ?? undefined,
                    title: `Sin propuesta hace ${days} días`,
                    subtitle: 'Sube su factura para analizar tarifas',
                    cta_label: 'Simular',
                    cta_href: `/dashboard/simulator?client=${c.id}`,
                    due_label: `${days}d`,
                    energy_stage: 'lead',
                });
            }
        }
    }

    // 3. Contratos próximos a vencer (<90d)
    const { data: expiringContracts } = await supabase
        .from('contracts')
        .select('id, client_id, end_date, marketer_name, clients(name, phone)')
        .eq('status', 'active')
        .eq('franchise_id', profile.franchise_id)
        .not('end_date', 'is', null);

    if (expiringContracts) {
        for (const c of expiringContracts) {
            if (!c.end_date) continue;
            const days = Math.floor((new Date(c.end_date).getTime() - now.getTime()) / 86_400_000);
            if (days <= 90 && days >= -30) {
                const client = getRelatedClient(c.clients);
                tasks.push({
                    id: `expiring-${c.id}`,
                    type: 'expiring_contract',
                    priority: days <= 30 ? 'critical' : 'high',
                    client_id: c.client_id,
                    client_name: client.name ?? 'Cliente',
                    phone: client.phone ?? undefined,
                    title: days < 0
                        ? `Contrato vencido hace ${Math.abs(days)}d`
                        : `Contrato vence en ${days}d`,
                    subtitle: c.marketer_name ? `Actual: ${c.marketer_name}` : 'Preparar renovación',
                    cta_label: 'Ver cliente',
                    cta_href: `/dashboard/clients/${c.client_id}`,
                    due_label: days < 0 ? 'Vencido' : `${days}d`,
                    energy_stage: 'renovable',
                });
            }
        }
    }

    // 4. ATRs con SLA prolongado
    const { data: staleAltas } = await supabase
        .from('proposals_alta')
        .select('id, client_id, client_name, alta_status, created_at')
        .in('alta_status', ['lista_admin', 'en_alta'])
        .eq('franchise_id', profile.franchise_id);

    if (staleAltas) {
        for (const a of staleAltas) {
            const days = Math.floor((now.getTime() - new Date(a.created_at).getTime()) / 86_400_000);
            if (days >= 7) {
                tasks.push({
                    id: `atr-${a.id}`,
                    type: 'atr_sla',
                    priority: days >= 15 ? 'critical' : 'high',
                    client_id: a.client_id ?? '',
                    client_name: a.client_name ?? 'Cliente',
                    title: `ATR ${a.alta_status === 'en_alta' ? 'en curso' : 'pendiente'} - ${days}d`,
                    subtitle: 'Verifica el estado con la distribuidora',
                    cta_label: 'Ver expediente',
                    cta_href: `/dashboard/proposals/${a.id}`,
                    due_label: `${days}d`,
                    energy_stage: 'atr_en_curso',
                });
            }
        }
    }

    // 5. Renovaciones detectadas con ahorro
    const { data: renewals } = await supabase
        .from('renewal_opportunities')
        .select('id, client_id, potential_savings, savings_percent, clients(name, phone)')
        .eq('status', 'open')
        .eq('franchise_id', profile.franchise_id)
        .order('potential_savings', { ascending: false })
        .limit(5);

    if (renewals) {
        for (const r of renewals) {
            const client = getRelatedClient(r.clients);
            tasks.push({
                id: `renewal-${r.id}`,
                type: 'renewal',
                priority: 'high',
                client_id: r.client_id,
                client_name: client.name ?? 'Cliente',
                phone: client.phone ?? undefined,
                title: `Renovación: ${r.potential_savings?.toFixed(0)}€ ahorro/año`,
                subtitle: `${r.savings_percent?.toFixed(1)}% vs tarifa actual`,
                cta_label: 'Contactar',
                cta_href: `/dashboard/clients/${r.client_id}`,
                due_label: 'Ahora',
                energy_stage: 'renovable',
            });
        }
    }

    // Ordenar por prioridad
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return tasks;
}

const supplyPointInputSchema = z.object({
    clientId: z.uuid(),
    cups: z.string().trim().min(5, 'El CUPS es obligatorio').max(60, 'El CUPS es demasiado largo'),
    supplyType: z.enum(['electricity', 'gas']),
    address: z.string().trim().max(300).optional().or(z.literal('')),
    currentMarketer: z.string().trim().max(120).optional().or(z.literal('')),
});

export async function getSupplyPointsAction(clientId: string): Promise<SupplyPoint[]> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    if (!z.uuid().safeParse(clientId).success) throw new Error('ID de cliente inválido');

    const { supabase } = await getSessionContext();
    const { data, error } = await supabase
        .from('supply_points')
        .select('*')
        .eq('client_id', clientId)
        .order('is_primary', { ascending: false });

    if (error) throw new Error(`Error cargando suministros: ${error.message}`);
    return ((data ?? []) as SupplyPointRow[]).map(hydrateSupplyPoint);
}

export async function createSupplyPointAction(input: z.infer<typeof supplyPointInputSchema>): Promise<SupplyPoint> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const parsed = supplyPointInputSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    const clean = parsed.data;
    const normalizedCups = normalizeCups(clean.cups);

    const { supabase } = await getSessionContext();
    const { count } = await supabase
        .from('supply_points')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clean.clientId);

    const { data, error } = await supabase
        .from('supply_points')
        .insert({
            client_id: clean.clientId,
            cups_ciphertext: encryptNullable(normalizedCups),
            cups_hash: hashCups(normalizedCups),
            cups_last4: normalizedCups.slice(-4),
            supply_type: clean.supplyType,
            address: clean.address || null,
            current_marketer: clean.currentMarketer || null,
            is_primary: (count ?? 0) === 0,
        })
        .select('*')
        .single();

    if (error) {
        const duplicate = error.code === '23505' || error.message.toLowerCase().includes('duplicate');
        throw new Error(duplicate ? 'Este CUPS ya existe' : `Error creando suministro: ${error.message}`);
    }

    revalidatePath(`/dashboard/clients/${clean.clientId}`);
    return hydrateSupplyPoint(data as SupplyPointRow);
}

export async function deleteSupplyPointAction(id: string, clientId: string): Promise<void> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    if (!z.uuid().safeParse(id).success) throw new Error('ID de suministro inválido');
    if (!z.uuid().safeParse(clientId).success) throw new Error('ID de cliente inválido');

    const { supabase } = await getSessionContext();
    const { data, error } = await supabase
        .from('supply_points')
        .delete()
        .eq('id', id)
        .eq('client_id', clientId)
        .select('id')
        .maybeSingle();

    if (error) throw new Error(`Error eliminando suministro: ${error.message}`);
    if (!data) throw new Error('No se pudo eliminar el suministro');

    revalidatePath(`/dashboard/clients/${clientId}`);
}

const switchReasonSchema = z.enum([
    'mejor_precio',
    'mejor_servicio',
    'fin_permanencia',
    'insatisfaccion',
    'nuevo_punto',
    'recomendacion',
]);

const switchEventInputSchema = z.object({
    clientId: z.uuid(),
    switchDate: z.string().trim().min(8),
    previousMarketer: z.string().trim().max(120).optional().or(z.literal('')),
    newMarketer: z.string().trim().min(1, 'La nueva comercializadora es obligatoria').max(120),
    annualSavings: z.number().nonnegative().optional().nullable(),
    reason: switchReasonSchema,
});

export async function getSwitchEventsAction(clientId: string): Promise<SwitchEvent[]> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    if (!z.uuid().safeParse(clientId).success) throw new Error('ID de cliente inválido');

    const { supabase } = await getSessionContext();
    const { data, error } = await supabase
        .from('switch_events')
        .select('*')
        .eq('client_id', clientId)
        .order('switch_date', { ascending: false });

    if (error) throw new Error(`Error cargando cambios: ${error.message}`);
    return (data ?? []) as SwitchEvent[];
}

export async function createSwitchEventAction(input: z.infer<typeof switchEventInputSchema>): Promise<void> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const parsed = switchEventInputSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    const clean = parsed.data;

    const { supabase } = await getSessionContext();
    const { error } = await supabase.from('switch_events').insert({
        client_id: clean.clientId,
        switch_date: clean.switchDate,
        previous_marketer: clean.previousMarketer || null,
        new_marketer: clean.newMarketer,
        annual_savings: clean.annualSavings ?? null,
        reason: clean.reason as SwitchReason,
    });

    if (error) throw new Error(`Error registrando cambio: ${error.message}`);
    revalidatePath(`/dashboard/clients/${clean.clientId}`);
}
