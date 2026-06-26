import { getMarketerLogo } from '@/lib/marketers/logos';
import { existsSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function euro(val: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
}

export function euro2(val: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

export function pct(val: number): string {
    return `${val.toFixed(1)}%`;
}

export function price(val?: number, unit = '€/kWh'): string {
    return val && val > 0 ? `${val.toFixed(4)} ${unit}` : '—';
}

export function getPdfLogoSource(marketer: string, snapshotLogo?: string | null): string | null {
    const logoUrl = snapshotLogo || getMarketerLogo(marketer);
    if (!logoUrl?.startsWith('/')) return logoUrl || null;

    const filePath = path.join(process.cwd(), 'public', logoUrl.replace(/^\/+/, ''));
    if (!existsSync(filePath)) return null;

    const base64 = readFileSync(filePath).toString('base64');
    return `data:image/jpeg;base64,${base64}`;
}

export function generateVerificationHash(proposalId: string, savings: number, currentCost: number): string {
    const input = `${proposalId}:${savings.toFixed(2)}:${currentCost.toFixed(2)}`;
    return createHash('sha256').update(input).digest('hex').slice(0, 12).toUpperCase();
}

/** Fecha de validez de la oferta a partir de la creación de la propuesta. */
export function offerValidityUntil(createdAtIso?: string, days = 15): string {
    const base = createdAtIso ? new Date(createdAtIso) : new Date();
    const until = new Date(base.getTime() + days * 86_400_000);
    return until.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Formatea un valor kW por periodo de forma compacta (ej. "4,93"). */
export function kw(val?: number): string {
    return val && val > 0 ? new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(val) : '—';
}

/** Formatea kWh por periodo (ej. "285"). */
export function kwh(val?: number): string {
    return val && val > 0 ? `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(val)} kWh` : '—';
}
