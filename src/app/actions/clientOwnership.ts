'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireServerRole } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

/**
 * Governed portfolio transfer (carterizacion).
 *
 * Ownership of a client feeds commission attribution, so moving it is a money decision, not
 * an edit. Every rule lives in `public.transfer_client_ownership`, which runs under the
 * caller's session, enforces scope, takes an optimistic version and writes immutable
 * evidence. This action only shapes input and translates failures into safe messages.
 */

const OWNERSHIP_REASONS = [
    'initial_assignment',
    'agent_reassignment',
    'agent_departure',
    'franchise_reassignment',
    'dispute_resolution',
    'data_correction',
] as const;

export type ClientOwnershipReason = typeof OWNERSHIP_REASONS[number];

const transferSchema = z.object({
    clientId: z.string().uuid(),
    toOwnerId: z.string().uuid(),
    expectedOwnershipVersion: z.number().int().min(0),
    reason: z.enum(OWNERSHIP_REASONS),
    notes: z.string().max(500).optional(),
    /** Supplied by the caller to make a retry idempotent; generated when absent. */
    requestId: z.string().uuid().optional(),
});

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Failure messages are mapped from stable codes. Anything unrecognised collapses to the
 * generic denial so an unexpected database error cannot leak structure to the browser.
 */
const ERROR_MESSAGES: Record<string, string> = {
    OWNERSHIP_INPUT_INVALID: 'Revisa los datos del traspaso.',
    OWNERSHIP_NOT_AUTHORIZED: 'No puedes traspasar este cliente.',
    OWNERSHIP_STALE_VERSION: 'Otra persona ha cambiado la propiedad de este cliente mientras lo editabas. Recarga y vuelve a intentarlo.',
    OWNERSHIP_UNCHANGED: 'El cliente ya pertenece a ese comercial.',
    OWNERSHIP_TARGET_INVALID: 'El destinatario no puede recibir clientes.',
    OWNERSHIP_REQUEST_CONFLICT: 'Esa solicitud de traspaso ya se usó con otros datos.',
    TRANSFER_REQUEST_INPUT_INVALID: 'Revisa los datos de la solicitud.',
    TRANSFER_REQUEST_NOT_AUTHORIZED: 'Solo puedes solicitar el traspaso de un cliente tuyo.',
    TRANSFER_REQUEST_TARGET_INVALID: 'Ese destinatario no pertenece a tu red.',
    TRANSFER_REQUEST_UNCHANGED: 'El cliente ya pertenece a ese comercial.',
    TRANSFER_REQUEST_ALREADY_PENDING: 'Ya hay una solicitud abierta para este cliente.',
    TRANSFER_DECISION_INPUT_INVALID: 'Revisa los datos de la decisión.',
    TRANSFER_DECISION_NOT_AUTHORIZED: 'No puedes decidir sobre esta solicitud.',
    TRANSFER_DECISION_ALREADY_DECIDED: 'Esta solicitud ya está resuelta.',
    TRANSFER_DECISION_SELF_APPROVAL: 'No puedes aprobar tu propia solicitud.',
    TRANSFER_DECISION_STALE: 'El cliente ha cambiado de propietario desde que se pidió el traspaso. Revisa la solicitud.',
};

const GENERIC_ERROR = 'No se pudo completar el traspaso.';

function messageFor(raw: string | undefined): string {
    if (!raw) return GENERIC_ERROR;
    const code = Object.keys(ERROR_MESSAGES).find(known => raw.includes(known));
    return code ? ERROR_MESSAGES[code] : GENERIC_ERROR;
}

export async function transferClientOwnershipAction(
    input: z.input<typeof transferSchema>,
): Promise<ActionResult<{ eventId: string; applied: boolean }>> {
    const parsed = transferSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: ERROR_MESSAGES.OWNERSHIP_INPUT_INVALID };
    }

    // Agents are rejected by the command as well; checking here avoids a pointless round
    // trip and keeps the action consistent with the rest of the mutating surface.
    await requireServerRole(['admin', 'franchise']);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('transfer_client_ownership', {
        p_client_id: parsed.data.clientId,
        p_to_owner_id: parsed.data.toOwnerId,
        p_expected_ownership_version: parsed.data.expectedOwnershipVersion,
        p_reason_code: parsed.data.reason,
        p_request_id: parsed.data.requestId ?? randomUUID(),
        p_notes: parsed.data.notes ?? null,
    });

    if (error) {
        return { success: false, error: messageFor(error.message) };
    }
    if (!data || typeof data !== 'object') {
        return { success: false, error: GENERIC_ERROR };
    }

    const record = data as { event_id?: string; applied?: boolean };
    if (!record.event_id) return { success: false, error: GENERIC_ERROR };

    revalidatePath('/dashboard/clients');
    revalidatePath('/dashboard/network');

    return { success: true, data: { eventId: record.event_id, applied: record.applied === true } };
}

const REQUEST_REASONS = [
    'agent_reassignment',
    'agent_departure',
    'dispute_resolution',
    'data_correction',
] as const;

const requestSchema = z.object({
    clientId: z.string().uuid(),
    toOwnerId: z.string().uuid(),
    reason: z.enum(REQUEST_REASONS),
    notes: z.string().max(500).optional(),
});

/**
 * An agent asks for one of their own clients to be moved. They cannot perform the move -
 * that is the whole point - so this only opens a request for a franchise or admin to decide.
 */
export async function requestClientOwnershipTransferAction(
    input: z.input<typeof requestSchema>,
): Promise<ActionResult<{ requestId: string; created: boolean }>> {
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: ERROR_MESSAGES.TRANSFER_REQUEST_INPUT_INVALID };
    }

    await requireServerRole(['admin', 'franchise', 'agent']);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('request_client_ownership_transfer', {
        p_client_id: parsed.data.clientId,
        p_to_owner_id: parsed.data.toOwnerId,
        p_reason_code: parsed.data.reason,
        p_notes: parsed.data.notes ?? null,
    });

    if (error) return { success: false, error: messageFor(error.message) };

    const record = (data ?? {}) as { request_id?: string; created?: boolean };
    if (!record.request_id) return { success: false, error: GENERIC_ERROR };

    revalidatePath('/dashboard/clients');
    return { success: true, data: { requestId: record.request_id, created: record.created === true } };
}

/**
 * A franchise or admin resolves a request. Approval runs the same governed transfer with
 * the approver as actor, so going through a request grants no extra privilege.
 */
export async function decideClientOwnershipTransferAction(
    requestId: string,
    approve: boolean,
    decisionNotes?: string,
): Promise<ActionResult<{ status: 'approved' | 'rejected' }>> {
    if (!z.string().uuid().safeParse(requestId).success
        || typeof approve !== 'boolean'
        || (decisionNotes !== undefined && decisionNotes.length > 500)) {
        return { success: false, error: ERROR_MESSAGES.TRANSFER_DECISION_INPUT_INVALID };
    }

    await requireServerRole(['admin', 'franchise']);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('decide_client_ownership_transfer', {
        p_request_id: requestId,
        p_approve: approve,
        p_decision_notes: decisionNotes ?? null,
    });

    if (error) return { success: false, error: messageFor(error.message) };

    const record = (data ?? {}) as { status?: string };
    if (record.status !== 'approved' && record.status !== 'rejected') {
        return { success: false, error: GENERIC_ERROR };
    }

    revalidatePath('/dashboard/clients');
    revalidatePath('/dashboard/network');
    return { success: true, data: { status: record.status } };
}

/** The requester withdraws their own pending request. */
export async function cancelClientOwnershipTransferAction(
    requestId: string,
): Promise<ActionResult<null>> {
    if (!z.string().uuid().safeParse(requestId).success) {
        return { success: false, error: ERROR_MESSAGES.TRANSFER_DECISION_INPUT_INVALID };
    }

    await requireServerRole(['admin', 'franchise', 'agent']);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('cancel_client_ownership_transfer', {
        p_request_id: requestId,
    });

    if (error) return { success: false, error: messageFor(error.message) };
    if ((data as { status?: string } | null)?.status !== 'cancelled') {
        return { success: false, error: GENERIC_ERROR };
    }

    revalidatePath('/dashboard/clients');
    return { success: true, data: null };
}

export interface ClientOwnershipEvent {
    id: string;
    createdAt: string;
    actorId: string;
    fromOwnerId: string;
    toOwnerId: string;
    reason: ClientOwnershipReason;
    notes: string | null;
}

/** Transfer history for one client. Visibility follows the reader's client scope via RLS. */
export async function getClientOwnershipHistoryAction(
    clientId: string,
): Promise<ClientOwnershipEvent[]> {
    if (!z.string().uuid().safeParse(clientId).success) return [];

    await requireServerRole(['admin', 'franchise', 'agent']);

    const supabase = await createClient();
    const { data, error } = await supabase
        .from('client_ownership_events')
        .select('id, created_at, actor_id, from_owner_id, to_owner_id, reason_code, notes')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error || !data) return [];

    return data.map(row => ({
        id: row.id as string,
        createdAt: row.created_at as string,
        actorId: row.actor_id as string,
        fromOwnerId: row.from_owner_id as string,
        toOwnerId: row.to_owner_id as string,
        reason: row.reason_code as ClientOwnershipReason,
        notes: (row.notes as string | null) ?? null,
    }));
}
