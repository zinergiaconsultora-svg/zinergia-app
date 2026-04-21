import { describe, expect, it } from 'vitest';
import { computeClientScore } from '../clientScoring';

// Fixed "now" = 2026-04-21T00:00:00Z
const NOW = new Date('2026-04-21T00:00:00Z').getTime();

function daysAgo(days: number): string {
    return new Date(NOW - days * 86_400_000).toISOString();
}

const CLIENT_ID = '00000000-0000-0000-0000-000000000001';

// ──────────────────────────────────────────────────────────────────────────────
// Baseline: no data
// ──────────────────────────────────────────────────────────────────────────────
describe('computeClientScore — no data', () => {
    it('returns 0 with no OCR, proposal, or meta', () => {
        const result = computeClientScore(CLIENT_ID, null, null, null, NOW);
        expect(result.score).toBe(0);
        expect(result.reasons).toEqual([]);
        expect(result.clientId).toBe(CLIENT_ID);
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// OCR anomaly scoring
// ──────────────────────────────────────────────────────────────────────────────
describe('computeClientScore — OCR anomalies', () => {
    it('adds +40 for reactive penalty (critical anomaly)', () => {
        const result = computeClientScore(
            CLIENT_ID,
            { forensic_details: { reactive_penalty: true }, current_energy_price_p1: null, tariff_name: null, total_amount: null },
            null, null, NOW,
        );
        expect(result.score).toBeGreaterThanOrEqual(40);
        expect(result.reasons).toContain('Anomalía crítica');
    });

    it('adds +40 for energy price > 0.22 €/kWh (critical)', () => {
        const result = computeClientScore(
            CLIENT_ID,
            { forensic_details: null, current_energy_price_p1: 0.23, tariff_name: null, total_amount: null },
            null, null, NOW,
        );
        expect(result.score).toBeGreaterThanOrEqual(40);
        expect(result.reasons).toContain('Anomalía crítica');
    });

    it('adds +20 for PVPC tariff (warning, no critical)', () => {
        const result = computeClientScore(
            CLIENT_ID,
            { forensic_details: null, current_energy_price_p1: 0.18, tariff_name: '2.0TD PVPC', total_amount: null },
            null, null, NOW,
        );
        expect(result.score).toBeGreaterThanOrEqual(20);
        expect(result.reasons).toContain('Anomalía detectada');
        expect(result.reasons).not.toContain('Anomalía crítica');
    });

    it('adds +20 for price > 0.19 (warning)', () => {
        const result = computeClientScore(
            CLIENT_ID,
            { forensic_details: null, current_energy_price_p1: 0.20, tariff_name: null, total_amount: null },
            null, null, NOW,
        );
        expect(result.reasons).toContain('Anomalía detectada');
    });

    it('does NOT add warning when critical is already set', () => {
        const result = computeClientScore(
            CLIENT_ID,
            { forensic_details: { reactive_penalty: true }, current_energy_price_p1: 0.20, tariff_name: 'PVPC', total_amount: null },
            null, null, NOW,
        );
        expect(result.reasons).toContain('Anomalía crítica');
        expect(result.reasons).not.toContain('Anomalía detectada');
    });

    it('adds no anomaly for normal price 0.15', () => {
        const result = computeClientScore(
            CLIENT_ID,
            { forensic_details: null, current_energy_price_p1: 0.15, tariff_name: 'TARIFA FIJA', total_amount: null },
            null, null, NOW,
        );
        expect(result.reasons).not.toContain('Anomalía crítica');
        expect(result.reasons).not.toContain('Anomalía detectada');
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// Savings potential scoring
// ──────────────────────────────────────────────────────────────────────────────
describe('computeClientScore — savings potential', () => {
    it('adds +20 for monthly > 167 € (annual > 2000)', () => {
        const result = computeClientScore(
            CLIENT_ID,
            { forensic_details: null, current_energy_price_p1: null, tariff_name: null, total_amount: 200 },
            null, null, NOW,
        );
        expect(result.reasons).toContain('Alto potencial');
        expect(result.score).toBeGreaterThanOrEqual(20);
    });

    it('adds +10 for monthly > 67 € (annual > 800)', () => {
        const result = computeClientScore(
            CLIENT_ID,
            { forensic_details: null, current_energy_price_p1: null, tariff_name: null, total_amount: 80 },
            null, null, NOW,
        );
        expect(result.reasons).toContain('Potencial medio');
    });

    it('adds nothing for low monthly bill (annual ≤ 800)', () => {
        const result = computeClientScore(
            CLIENT_ID,
            { forensic_details: null, current_energy_price_p1: null, tariff_name: null, total_amount: 60 },
            null, null, NOW,
        );
        expect(result.reasons).not.toContain('Alto potencial');
        expect(result.reasons).not.toContain('Potencial medio');
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// Days without proposal (new client)
// ──────────────────────────────────────────────────────────────────────────────
describe('computeClientScore — new client, no proposal', () => {
    it('adds +20 for new client with no proposal > 7 days', () => {
        const result = computeClientScore(
            CLIENT_ID, null, null,
            { status: 'new', created_at: daysAgo(10) },
            NOW,
        );
        expect(result.reasons).toContain('Sin propuesta');
        expect(result.score).toBeGreaterThanOrEqual(20);
    });

    it('adds +10 for new client with no proposal > 3 days and ≤ 7 days', () => {
        const result = computeClientScore(
            CLIENT_ID, null, null,
            { status: 'new', created_at: daysAgo(5) },
            NOW,
        );
        expect(result.reasons).toContain('Sin propuesta');
        // score includes +10 proposal + +10 status bonus
        expect(result.score).toBe(20);
    });

    it('adds nothing for new client < 3 days without proposal', () => {
        const result = computeClientScore(
            CLIENT_ID, null, null,
            { status: 'new', created_at: daysAgo(2) },
            NOW,
        );
        expect(result.reasons).not.toContain('Sin propuesta');
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// Days without proposal (after rejected/lost)
// ──────────────────────────────────────────────────────────────────────────────
describe('computeClientScore — rejected proposal follow-up', () => {
    const meta = { status: 'contacted', created_at: daysAgo(60) };

    it('adds +20 for > 14 days after rejection', () => {
        const result = computeClientScore(
            CLIENT_ID, null,
            { status: 'rejected', created_at: daysAgo(20) },
            meta, NOW,
        );
        expect(result.reasons).toContain('>14d sin propuesta');
    });

    it('adds +12 for > 7 days and ≤ 14 days after rejection', () => {
        const result = computeClientScore(
            CLIENT_ID, null,
            { status: 'rejected', created_at: daysAgo(10) },
            meta, NOW,
        );
        expect(result.reasons).toContain('>7d sin propuesta');
    });

    it('adds +5 for > 3 days and ≤ 7 days after rejection (no reason label)', () => {
        const result = computeClientScore(
            CLIENT_ID, null,
            { status: 'rejected', created_at: daysAgo(5) },
            meta, NOW,
        );
        // Score should include 5 (proposal) + 5 (contacted status)
        expect(result.score).toBe(10);
    });

    it('does NOT add proposal urgency for accepted proposals', () => {
        const result = computeClientScore(
            CLIENT_ID, null,
            { status: 'accepted', created_at: daysAgo(100) },
            meta, NOW,
        );
        expect(result.reasons).not.toContain('>14d sin propuesta');
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// Status bonus
// ──────────────────────────────────────────────────────────────────────────────
describe('computeClientScore — status bonus', () => {
    it('adds +10 for status new', () => {
        const result = computeClientScore(
            CLIENT_ID, null, null,
            { status: 'new', created_at: daysAgo(1) },
            NOW,
        );
        expect(result.score).toBe(10);
    });

    it('adds +5 for status contacted', () => {
        const result = computeClientScore(
            CLIENT_ID, null, null,
            { status: 'contacted', created_at: daysAgo(1) },
            NOW,
        );
        expect(result.score).toBe(5);
    });

    it('adds no bonus for status won', () => {
        const result = computeClientScore(
            CLIENT_ID, null,
            { status: 'accepted', created_at: daysAgo(1) },
            { status: 'won', created_at: daysAgo(1) },
            NOW,
        );
        expect(result.score).toBe(0);
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// Score cap at 100
// ──────────────────────────────────────────────────────────────────────────────
describe('computeClientScore — cap at 100', () => {
    it('never exceeds 100 even with all signals present', () => {
        const result = computeClientScore(
            CLIENT_ID,
            {
                forensic_details: { reactive_penalty: true },  // +40
                current_energy_price_p1: 0.25,                  // +40 (but critical already set)
                tariff_name: null,
                total_amount: 500,                              // +20 (alto potencial, 6000/year)
            },
            { status: 'rejected', created_at: daysAgo(30) },   // +20
            { status: 'new', created_at: daysAgo(30) },         // +10
            NOW,
        );
        expect(result.score).toBeLessThanOrEqual(100);
        expect(result.score).toBe(90); // 40+20+20+10 = 90, capped at 100
    });
});
