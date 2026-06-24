import type { AdminLeadFilters, AdminLeadOutcome, AdminLeadQueue } from '@/app/actions/invoices';

const OUTCOMES = ['open', 'won', 'lost', 'all'] as const satisfies readonly AdminLeadOutcome[];
const QUEUES = ['drive_pending', 'ocr_failed', 'needs_comparison', 'permanence_due', 'cooling', 'needs_review'] as const satisfies readonly AdminLeadQueue[];

type SearchParamsLike = URLSearchParams | Record<string, string | string[] | undefined>;

function firstParam(params: SearchParamsLike, key: string): string | undefined {
    if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
}

function parseOutcome(value: string | undefined): AdminLeadOutcome {
    return OUTCOMES.includes(value as AdminLeadOutcome) ? (value as AdminLeadOutcome) : 'open';
}

function parseQueue(value: string | undefined): AdminLeadQueue | undefined {
    return QUEUES.includes(value as AdminLeadQueue) ? (value as AdminLeadQueue) : undefined;
}

function clean(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

export function parseAdminLeadFilters(params: SearchParamsLike): AdminLeadFilters {
    return {
        outcome: parseOutcome(firstParam(params, 'outcome')),
        queue: parseQueue(firstParam(params, 'queue')),
        search: clean(firstParam(params, 'search')),
        agentId: clean(firstParam(params, 'agentId')),
        franchiseId: clean(firstParam(params, 'franchiseId')),
    };
}

export function buildAdminLeadQueryString(filters: AdminLeadFilters): string {
    const params = new URLSearchParams();
    params.set('outcome', filters.outcome ?? 'open');

    if (filters.queue) params.set('queue', filters.queue);

    const search = clean(filters.search);
    const agentId = clean(filters.agentId);
    const franchiseId = clean(filters.franchiseId);

    if (search) params.set('search', search);
    if (agentId) params.set('agentId', agentId);
    if (franchiseId) params.set('franchiseId', franchiseId);

    return params.toString();
}
