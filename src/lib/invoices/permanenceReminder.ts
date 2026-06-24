/**
 * Builds the reminder payload for an invoice whose permanence is about to end,
 * so the comercial can review/renew it. Pure and unit-testable; the cron wires
 * the DB query + notification insert + push around it.
 */

export interface PermanenceReminderInput {
    company: string | null;
    permanenceUntil: string; // ISO date (YYYY-MM-DD)
}

export interface PermanenceReminder {
    title: string;
    message: string;
    link: string;
    type: 'warning';
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function buildPermanenceReminder({ company, permanenceUntil }: PermanenceReminderInput): PermanenceReminder {
    const who = company?.trim() ? company.trim() : 'la compañía contratada';
    return {
        title: 'Permanencia próxima a vencer',
        message: `La permanencia con ${who} vence el ${formatDate(permanenceUntil)}. Revisa la factura para renovar o cambiar.`,
        link: '/dashboard/invoices',
        type: 'warning',
    };
}
