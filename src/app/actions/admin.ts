'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireServerRole } from '@/lib/auth/permissions';
import { revalidatePath } from 'next/cache';
import { uuidSchema, createFranchiseSchema } from '@/lib/validation/schemas';
import { z } from 'zod';
import { logAdminAction } from '@/lib/audit/logger';
import { changeProfileAuthorityCommand, updateTeamMemberNameCommand } from '@/lib/profile-authority/commands';
import {
    authorityChangeInputSchema,
    authorityReasonCodeSchema,
    authoritySummarySchema,
    type AuthorityChangeInput,
    type AuthoritySummary,
} from '@/lib/profile-authority/schemas';
import { teamMemberNameInputSchema } from '@/lib/profile-authority/schemas';
import { getProfileAuthoritySnapshot } from '@/lib/profile-authority/authoritySnapshot';

// ─── Types ────────────────────────────────────────────────────────────
export interface AdminStats {
    totalFranchises: number;
    activeFranchises: number;
    totalAgents: number;
    commissionsPending: number;
    commissionsCleared: number;
    commissionsPaid: number;
    totalCommissionValue: number;
    billingCyclesClosed: number;
}

export interface FranchiseWithAgents {
    id: string;
    slug: string;
    name: string;
    is_active: boolean;
    created_at: string;
    agent_count: number;
    agents: { id: string; full_name: string | null; email: string }[];
}

export interface AgentProfile {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    franchise_id: string | null;
}

export type ProfileAuthoritySummary = AuthoritySummary;

type ActionResult<T> =
    | { success: true; data: T }
    | { success: false; error: string };

// ─── Queries ──────────────────────────────────────────────────────────

export async function getAdminStats(): Promise<AdminStats> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const [franchises, agents, commissions, cycles] = await Promise.all([
        supabase.from('franchises').select('id, is_active'),
        supabase.from('profiles').select('id').eq('role', 'agent'),
        supabase.from('network_commissions').select('status, franchise_commission'),
        supabase.from('billing_cycles').select('status').eq('status', 'closed'),
    ]);

    const franchiseData = franchises.data ?? [];
    const commData = commissions.data ?? [];

    return {
        totalFranchises: franchiseData.length,
        activeFranchises: franchiseData.filter(f => f.is_active).length,
        totalAgents: agents.data?.length ?? 0,
        commissionsPending: commData.filter(c => c.status === 'pending').length,
        commissionsCleared: commData.filter(c => c.status === 'cleared').length,
        commissionsPaid: commData.filter(c => c.status === 'paid').length,
        totalCommissionValue: commData.reduce((sum, c) => sum + (c.franchise_commission ?? 0), 0),
        billingCyclesClosed: cycles.data?.length ?? 0,
    };
}

export async function getAllFranchises(): Promise<FranchiseWithAgents[]> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const { data: franchises, error } = await supabase
        .from('franchises')
        .select('id, slug, name, is_active, created_at')
        .order('created_at', { ascending: false });

    if (error) throw new Error(`Error cargando franquicias: ${error.message}`);

    // Contar agentes por franquicia
    const { data: agents } = await supabase
        .from('profiles')
        .select('id, full_name, email, franchise_id')
        .in('role', ['agent', 'franchise']);

    const agentsByFranchise = new Map<string, { id: string; full_name: string | null; email: string }[]>();
    (agents ?? []).forEach(a => {
        if (a.franchise_id) {
            const list = agentsByFranchise.get(a.franchise_id) ?? [];
            list.push({ id: a.id, full_name: a.full_name, email: a.email });
            agentsByFranchise.set(a.franchise_id, list);
        }
    });

    return (franchises ?? []).map(f => {
        const franchiseAgents = agentsByFranchise.get(f.id) ?? [];
        return {
            ...f,
            agent_count: franchiseAgents.length,
            agents: franchiseAgents,
        };
    });
}

export async function getUnassignedAgents(): Promise<AgentProfile[]> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, franchise_id')
        .eq('role', 'agent')
        .is('franchise_id', null)
        .order('email');

    if (error) throw new Error(`Error cargando agentes: ${error.message}`);
    return data ?? [];
}

// ─── Mutations ────────────────────────────────────────────────────────

export async function toggleFranchiseActive(franchiseId: string, isActive: boolean): Promise<void> {
    await requireServerRole(['admin']);
    const id = uuidSchema.parse(franchiseId);
    const active = z.boolean().parse(isActive);
    const supabase = await createClient();

    const { error } = await supabase
        .from('franchises')
        .update({ is_active: active })
        .eq('id', id);

    if (error) throw new Error(`Error actualizando franquicia: ${error.message}`);
}

export async function assignAgentToFranchise(
    agentId: string,
    franchiseId: string,
): Promise<ActionResult<{ eventId: string }>> {
    await requireServerRole(['admin']);
    const ids = z.object({ agentId: z.uuid(), franchiseId: z.uuid() }).safeParse({ agentId, franchiseId });
    if (!ids.success) return { success: false, error: 'No se pudo asignar la franquicia.' };

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    const target = await getProfileAuthoritySnapshot(ids.data.agentId);
    if (authError || !user || !target || target.role !== 'agent') {
        return { success: false, error: 'No se pudo asignar la franquicia.' };
    }

    const result = await changeProfileAuthorityCommand(user.id, {
        targetId: target.id,
        desiredRole: 'agent',
        parentId: user.id,
        franchiseId: ids.data.franchiseId,
        expectedAuthorityVersion: target.authority_version,
        reasonCode: 'franchise_assignment',
        requestId: crypto.randomUUID(),
    });
    const mapped = mapAuthorityCommandResult(result.data, result.error);
    if (mapped.success) {
        revalidatePath('/admin');
        revalidatePath('/admin/agents');
    }
    return mapped;
}

export async function removeAgentFromFranchise(agentId: string): Promise<ActionResult<{ eventId: string }>> {
    await requireServerRole(['admin']);
    const id = z.uuid().safeParse(agentId);
    if (!id.success) return { success: false, error: 'No se pudo desvincular el perfil.' };

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    const target = await getProfileAuthoritySnapshot(id.data);
    if (authError || !user || !target) {
        return { success: false, error: 'No se pudo desvincular el perfil.' };
    }

    const result = await changeProfileAuthorityCommand(user.id, {
        targetId: target.id,
        desiredRole: null,
        parentId: null,
        franchiseId: null,
        expectedAuthorityVersion: target.authority_version,
        reasonCode: 'franchise_removal',
        requestId: crypto.randomUUID(),
    });
    const mapped = mapAuthorityCommandResult(result.data, result.error);
    if (mapped.success) {
        revalidatePath('/admin');
        revalidatePath('/admin/agents');
    }
    return mapped;
}

export async function createFranchiseAction(name: string): Promise<void> {
    await requireServerRole(['admin']);
    const { name: validName } = createFranchiseSchema.parse({ name });
    const supabase = await createClient();

    const slug = validName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const { error } = await supabase
        .from('franchises')
        .insert({ name: validName.trim(), slug, is_active: true });

    if (error) throw new Error(`Error creando franquicia: ${error.message}`);
    revalidatePath('/admin');
    logAdminAction('create_franchise', 'franchises', undefined, { name: validName }).catch(() => {});
}

export async function getAllAgentsAction(): Promise<AgentProfile[]> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, franchise_id')
        .in('role', ['agent', 'franchise', 'admin'])
        .order('full_name', { ascending: true });

    if (error) throw new Error(`Error cargando agentes: ${error.message}`);
    return data ?? [];
}

export async function getAdminProfileAuthoritySummariesAction(): Promise<ActionResult<ProfileAuthoritySummary[]>> {
    await requireServerRole(['admin']);
    const service = createServiceClient();
    const { data, error } = await service
        .from('profiles')
        .select('id, email, full_name, role, parent_id, franchise_id, authority_version')
        .order('full_name', { ascending: true });

    if (error) {
        return { success: false, error: 'No se pudieron cargar los perfiles.' };
    }

    const parsed = z.array(authoritySummarySchema).safeParse((data ?? []).map(profile => ({
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: profile.role,
        parentId: profile.parent_id,
        franchiseId: profile.franchise_id,
        authorityVersion: profile.authority_version,
    })));
    if (!parsed.success) {
        return { success: false, error: 'No se pudieron cargar los perfiles.' };
    }

    return { success: true, data: parsed.data };
}

/**
 * Los códigos del mando de autoridad, en algo que un administrador pueda usar.
 *
 * "No se pudo actualizar la autoridad" era la respuesta a casi todo: quien
 * dejaba la franquicia vacía leía lo mismo que quien elegía un responsable
 * imposible, y no había forma de saber qué corregir. Cada motivo dice ahora qué
 * hacer.
 */
const AUTHORITY_ERROR_MESSAGES: Record<string, string> = {
    LAST_ADMIN: 'Debe permanecer al menos un administrador activo.',
    AUTHORITY_CYCLE: 'Esa persona ya está por encima en la jerarquía: se crearía un bucle.',
    STALE_AUTHORITY_VERSION: 'El perfil ha cambiado mientras editabas. Cierra, recarga e inténtalo de nuevo.',
    REQUEST_ID_CONFLICT: 'La solicitud ya se utilizó con otros datos. Cierra y vuelve a abrir el diálogo.',
    AUTHORITY_TUPLE_INVALID: 'Falta el responsable, o la franquicia elegida no existe o está inactiva.',
    AUTHORITY_PARENT_INVALID: 'Ese responsable no vale para esta combinación. Sin franquicia, el responsable debe ser la cuenta de administración.',
    ACTOR_NOT_ADMIN: 'Solo la cuenta de administración puede cambiar la autoridad de un perfil.',
    TARGET_NOT_FOUND: 'No se ha encontrado ese perfil.',
    AUTHORITY_INPUT_INVALID: 'Faltan datos obligatorios o el motivo no es válido.',
};

function mapAuthorityCommandResult(
    data: unknown,
    error: { message?: string } | null,
): ActionResult<{ eventId: string }> {
    if (error) {
        const safeMessage = Object.entries(AUTHORITY_ERROR_MESSAGES)
            .find(([code]) => error.message?.includes(code))?.[1]
            ?? 'No se pudo actualizar la autoridad.';
        return { success: false, error: safeMessage };
    }

    const eventId = data && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, unknown>).event_id
        : undefined;
    return typeof eventId === 'string'
        ? { success: true, data: { eventId } }
        : { success: false, error: 'No se pudo actualizar la autoridad.' };
}

export async function changeProfileAuthorityAdminAction(
    input: AuthorityChangeInput,
): Promise<ActionResult<{ eventId: string }>> {
    const inputRecord = input as unknown as Record<string, unknown>;
    if (!authorityReasonCodeSchema.safeParse(inputRecord.reasonCode).success) {
        return { success: false, error: 'Selecciona un motivo válido.' };
    }
    const parsed = authorityChangeInputSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: 'La solicitud de autoridad no es válida.' };
    }

    await requireServerRole(['admin']);
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return { success: false, error: 'No se pudo actualizar la autoridad.' };
    }

    const { data, error } = await changeProfileAuthorityCommand(user.id, parsed.data);
    const result = mapAuthorityCommandResult(data, error);
    if (!result.success) return result;

    revalidatePath('/admin');
    revalidatePath('/admin/agents');
    return result;
}

export async function updateAgentAdminAction(
    agentId: string,
    updates: { full_name?: string; role?: string; franchise_id?: string | null },
): Promise<ActionResult<null>> {
    if (updates.role !== undefined || updates.franchise_id !== undefined) {
        return { success: false, error: 'Guarda identidad y autoridad por separado.' };
    }
    if (typeof updates.full_name !== 'string') {
        return { success: false, error: 'La corrección de nombre no es válida.' };
    }
    const parsed = teamMemberNameInputSchema.safeParse({ targetId: agentId, fullName: updates.full_name });
    if (!parsed.success) return { success: false, error: 'La corrección de nombre no es válida.' };

    await requireServerRole(['admin']);
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { success: false, error: 'No se pudo actualizar el nombre.' };

    const { error } = await updateTeamMemberNameCommand(user.id, parsed.data);
    return error
        ? { success: false, error: 'No se pudo actualizar el nombre.' }
        : { success: true, data: null };
}

// ─── Reporting Queries ────────────────────────────────────────────────

export interface TimeSeriesPoint {
    month: string; // 'YYYY-MM'
    pending: number;
    approved: number;
    paid: number;
    total: number;
}

export interface ProposalTimeSeriesPoint {
    month: string;
    draft: number;
    sent: number;
    accepted: number;
    rejected: number;
    total: number;
    conversionRate: number;
}

export interface AgentRankingEntry {
    id: string;
    full_name: string;
    email: string;
    franchise_name: string | null;
    proposals_total: number;
    proposals_accepted: number;
    total_commission: number;
    conversion_rate: number;
}

function getMonthKey(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function generateMonthRange(months: number): string[] {
    const result: string[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return result;
}

export async function getCommissionTimeSeries(months = 12): Promise<TimeSeriesPoint[]> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('network_commissions')
        .select('status, franchise_commission, created_at')
        .order('created_at', { ascending: true });

    if (error) throw new Error(`Error cargando comisiones: ${error.message}`);

    const monthRange = generateMonthRange(months);
    const buckets = new Map<string, TimeSeriesPoint>();
    monthRange.forEach(m => buckets.set(m, { month: m, pending: 0, approved: 0, paid: 0, total: 0 }));

    (data ?? []).forEach(row => {
        const key = getMonthKey(row.created_at);
        const bucket = buckets.get(key);
        if (!bucket) return;
        const amount = Number(row.franchise_commission) || 0;
        bucket.total += amount;
        if (row.status === 'pending') bucket.pending += amount;
        else if (row.status === 'approved') bucket.approved += amount;
        else if (row.status === 'paid') bucket.paid += amount;
    });

    return monthRange.map(m => buckets.get(m)!);
}

export async function getProposalTimeSeries(months = 12): Promise<ProposalTimeSeriesPoint[]> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('proposals')
        .select('status, created_at')
        .order('created_at', { ascending: true });

    if (error) throw new Error(`Error cargando propuestas: ${error.message}`);

    const monthRange = generateMonthRange(months);
    const buckets = new Map<string, ProposalTimeSeriesPoint>();
    monthRange.forEach(m => buckets.set(m, { month: m, draft: 0, sent: 0, accepted: 0, rejected: 0, total: 0, conversionRate: 0 }));

    (data ?? []).forEach(row => {
        const key = getMonthKey(row.created_at);
        const bucket = buckets.get(key);
        if (!bucket) return;
        bucket.total++;
        if (row.status === 'draft') bucket.draft++;
        else if (row.status === 'sent') bucket.sent++;
        else if (row.status === 'accepted') bucket.accepted++;
        else if (row.status === 'rejected') bucket.rejected++;
    });

    // Calcular tasa de conversión
    monthRange.forEach(m => {
        const b = buckets.get(m)!;
        b.conversionRate = b.total > 0 ? Math.round((b.accepted / b.total) * 100) : 0;
    });

    return monthRange.map(m => buckets.get(m)!);
}

export async function getAgentPerformanceRanking(): Promise<AgentRankingEntry[]> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const [agentsRes, proposalsRes, commissionsRes, franchisesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, franchise_id').eq('role', 'agent'),
        supabase.from('proposals').select('id, client_id, status'),
        supabase.from('network_commissions').select('agent_id, franchise_commission, status'),
        supabase.from('franchises').select('id, name'),
    ]);

    const agents = agentsRes.data ?? [];
    const proposals = proposalsRes.data ?? [];
    const commissions = commissionsRes.data ?? [];
    const franchises = franchisesRes.data ?? [];

    // Mapear clientes a sus owners para vincular propuestas a agentes
    const { data: clients } = await supabase.from('clients').select('id, owner_id');
    const clientOwnerMap = new Map<string, string>();
    (clients ?? []).forEach(c => clientOwnerMap.set(c.id, c.owner_id));

    const franchiseMap = new Map<string, string>();
    franchises.forEach(f => franchiseMap.set(f.id, f.name));

    return agents.map(agent => {
        const agentProposals = proposals.filter(p => clientOwnerMap.get(p.client_id) === agent.id);
        const agentCommissions = commissions.filter(c => c.agent_id === agent.id);
        const totalComm = agentCommissions.reduce((s, c) => s + (Number(c.franchise_commission) || 0), 0);
        const accepted = agentProposals.filter(p => p.status === 'accepted').length;
        const total = agentProposals.length;

        return {
            id: agent.id,
            full_name: agent.full_name ?? 'Sin nombre',
            email: agent.email ?? '',
            franchise_name: agent.franchise_id ? (franchiseMap.get(agent.franchise_id) ?? null) : null,
            proposals_total: total,
            proposals_accepted: accepted,
            total_commission: totalComm,
            conversion_rate: total > 0 ? Math.round((accepted / total) * 100) : 0,
        };
    }).sort((a, b) => b.total_commission - a.total_commission);
}
