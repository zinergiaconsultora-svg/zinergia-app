/**
 * Shared Zod schemas for server action input validation.
 *
 * Import from this module instead of re-defining the same shapes in each
 * server action. All schemas are strict by default — unknown keys are stripped.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const uuidSchema = z.uuid('ID inválido');

export const monthYearSchema = z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Formato esperado: YYYY-MM');

// ---------------------------------------------------------------------------
// Commission rule
// ---------------------------------------------------------------------------

export const commissionRuleSchema = z
    .object({
        name: z.string().min(1, 'El nombre es obligatorio').max(120),
        commission_rate: z
            .number()
            .gt(0, 'Debe ser mayor que 0')
            .lte(1, 'Debe ser como máximo 1 (100%)'),
        agent_share: z.number().min(0).max(1),
        franchise_share: z.number().min(0).max(1),
        hq_share: z.number().min(0).max(1),
        points_per_win: z.number().int().min(0),
    })
    .superRefine((data, ctx) => {
        const total = data.agent_share + data.franchise_share + data.hq_share;
        if (Math.abs(total - 1) > 0.001) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['agent_share'],
                message: `Los porcentajes deben sumar 100%. Suma actual: ${(total * 100).toFixed(1)}%`,
            });
        }
    });

export type CommissionRuleInput = z.infer<typeof commissionRuleSchema>;

// ---------------------------------------------------------------------------
// Offer (tariff)
// ---------------------------------------------------------------------------

export const offerSchema = z
    .object({
        // Identification
        id: uuidSchema.optional(),
        nombre: z.string().min(1, 'El nombre es obligatorio').max(200),
        comercializadora: z.string().min(1).max(100),
        tipo: z.enum(['electricidad', 'gas', 'dual']),

        // Pricing (nullable for optional fields)
        precio_p1: z.number().min(0).nullable().optional(),
        precio_p2: z.number().min(0).nullable().optional(),
        precio_p3: z.number().min(0).nullable().optional(),
        precio_p4: z.number().min(0).nullable().optional(),
        precio_p5: z.number().min(0).nullable().optional(),
        precio_p6: z.number().min(0).nullable().optional(),
        precio_potencia_p1: z.number().min(0).nullable().optional(),
        precio_potencia_p2: z.number().min(0).nullable().optional(),
        precio_potencia_p3: z.number().min(0).nullable().optional(),
        precio_potencia_p4: z.number().min(0).nullable().optional(),
        precio_potencia_p5: z.number().min(0).nullable().optional(),
        precio_potencia_p6: z.number().min(0).nullable().optional(),
        precio_fijo_mensual: z.number().min(0).nullable().optional(),
        descuento_pct: z.number().min(0).max(100).nullable().optional(),

        // Metadata
        activa: z.boolean().optional(),
        notas: z.string().max(2000).nullable().optional(),
        permanencia_meses: z.number().int().min(0).nullable().optional(),
        tipo_cliente: z.enum(['particular', 'empresa', 'ambos']).nullable().optional(),
        comunidades_autonomas: z.array(z.string()).nullable().optional(),
    })
    .strict();

export type OfferInput = z.infer<typeof offerSchema>;

// ---------------------------------------------------------------------------
// Admin — agent update
// ---------------------------------------------------------------------------

const USER_ROLES = ['admin', 'franchise', 'agent'] as const;

export const updateAgentSchema = z
    .object({
        full_name: z.string().min(1).max(120).optional(),
        role: z.enum(USER_ROLES).optional(),
        franchise_id: uuidSchema.nullable().optional(),
    })
    .strict();

export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;

// ---------------------------------------------------------------------------
// Admin — franchise create
// ---------------------------------------------------------------------------

export const createFranchiseSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(120),
});
