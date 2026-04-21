import { describe, expect, it } from 'vitest';
import {
    commissionRuleSchema,
    createFranchiseSchema,
    monthYearSchema,
    offerSchema,
    updateAgentSchema,
    uuidSchema,
} from '../schemas';

// ---------------------------------------------------------------------------
// uuidSchema
// ---------------------------------------------------------------------------
describe('uuidSchema', () => {
    it('accepts a valid UUID v4', () => {
        expect(uuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
    });
    it('rejects a plain string', () => {
        expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
    });
    it('rejects an empty string', () => {
        expect(uuidSchema.safeParse('').success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// monthYearSchema
// ---------------------------------------------------------------------------
describe('monthYearSchema', () => {
    it('accepts YYYY-MM format', () => {
        expect(monthYearSchema.safeParse('2026-04').success).toBe(true);
    });
    it('rejects invalid month 13', () => {
        expect(monthYearSchema.safeParse('2026-13').success).toBe(false);
    });
    it('rejects month 00', () => {
        expect(monthYearSchema.safeParse('2026-00').success).toBe(false);
    });
    it('rejects plain year', () => {
        expect(monthYearSchema.safeParse('2026').success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// commissionRuleSchema
// ---------------------------------------------------------------------------
describe('commissionRuleSchema', () => {
    const valid = {
        name: 'Regla estándar',
        commission_rate: 0.15,
        agent_share: 0.30,
        franchise_share: 0.50,
        hq_share: 0.20,
        points_per_win: 50,
    };

    it('accepts a valid rule', () => {
        expect(commissionRuleSchema.safeParse(valid).success).toBe(true);
    });

    it('rejects commission_rate = 0', () => {
        const r = commissionRuleSchema.safeParse({ ...valid, commission_rate: 0 });
        expect(r.success).toBe(false);
    });

    it('rejects commission_rate > 1', () => {
        expect(commissionRuleSchema.safeParse({ ...valid, commission_rate: 1.01 }).success).toBe(false);
    });

    it('rejects shares summing to != 1', () => {
        const r = commissionRuleSchema.safeParse({ ...valid, agent_share: 0.40 }); // 0.40+0.50+0.20 = 1.10
        expect(r.success).toBe(false);
    });

    it('rejects empty name', () => {
        expect(commissionRuleSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
    });

    it('rejects negative points_per_win', () => {
        expect(commissionRuleSchema.safeParse({ ...valid, points_per_win: -1 }).success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// offerSchema
// ---------------------------------------------------------------------------
describe('offerSchema', () => {
    const valid = {
        nombre: 'Tarifa Plana Plus',
        comercializadora: 'Iberdrola',
        tipo: 'electricidad' as const,
    };

    it('accepts a minimal valid offer', () => {
        expect(offerSchema.safeParse(valid).success).toBe(true);
    });

    it('accepts offer with optional pricing fields', () => {
        const full = { ...valid, precio_p1: 0.12, precio_p2: 0.09, activa: true };
        expect(offerSchema.safeParse(full).success).toBe(true);
    });

    it('rejects unknown fields (strict mode)', () => {
        expect(offerSchema.safeParse({ ...valid, hacked_field: 'x' }).success).toBe(false);
    });

    it('rejects invalid tipo', () => {
        expect(offerSchema.safeParse({ ...valid, tipo: 'agua' }).success).toBe(false);
    });

    it('rejects negative precio_p1', () => {
        expect(offerSchema.safeParse({ ...valid, precio_p1: -0.01 }).success).toBe(false);
    });

    it('rejects empty nombre', () => {
        expect(offerSchema.safeParse({ ...valid, nombre: '' }).success).toBe(false);
    });

    it('rejects descuento_pct > 100', () => {
        expect(offerSchema.safeParse({ ...valid, descuento_pct: 101 }).success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// updateAgentSchema
// ---------------------------------------------------------------------------
describe('updateAgentSchema', () => {
    it('accepts a valid partial update', () => {
        expect(updateAgentSchema.safeParse({ full_name: 'Ana García', role: 'agent' }).success).toBe(true);
    });

    it('accepts null franchise_id (unassign)', () => {
        expect(updateAgentSchema.safeParse({ franchise_id: null }).success).toBe(true);
    });

    it('rejects unknown role', () => {
        expect(updateAgentSchema.safeParse({ role: 'superadmin' }).success).toBe(false);
    });

    it('rejects unknown keys (strict mode)', () => {
        expect(updateAgentSchema.safeParse({ email: 'x@y.com' }).success).toBe(false);
    });

    it('accepts empty object (no-op update)', () => {
        expect(updateAgentSchema.safeParse({}).success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// createFranchiseSchema
// ---------------------------------------------------------------------------
describe('createFranchiseSchema', () => {
    it('accepts a valid name', () => {
        expect(createFranchiseSchema.safeParse({ name: 'Franquicia Sur' }).success).toBe(true);
    });

    it('rejects names shorter than 2 chars', () => {
        expect(createFranchiseSchema.safeParse({ name: 'A' }).success).toBe(false);
    });

    it('rejects empty name', () => {
        expect(createFranchiseSchema.safeParse({ name: '' }).success).toBe(false);
    });
});
