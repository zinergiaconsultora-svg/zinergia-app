import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260731220129_commission_lifecycle_ledger.sql'),
    'utf8',
);

const configurationMigration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260801025504_configure_commission_model.sql'),
    'utf8',
);

const configurationFixMigration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260801030120_fix_configure_commission_model_assignment.sql'),
    'utf8',
);

const decommissionPolicyMigration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260801095258_configure_decommission_policy.sql'),
    'utf8',
);

const proportionalPermanenceMigration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260802102124_version_commission_and_proportional_permanence.sql'),
    'utf8',
);

describe('commission lifecycle migration contract', () => {
    it('creates versioned economic plans, assignments and decommission policies', () => {
        expect(migration).toContain('CREATE TABLE public.commission_plans');
        expect(migration).toContain('CREATE TABLE public.commission_plan_assignments');
        expect(migration).toContain('CREATE TABLE public.commission_decommission_policies');
        expect(migration).toContain('CREATE TABLE public.commission_decommission_bands');
        expect(migration).toContain('commission_plans_balanced_check');
        expect(migration).toContain('commission_plans_direct_franchise_check');
        expect(migration).toContain('commission_plan_assignments_no_self_check');
    });

    it('adds a balanced frozen allocation to the canonical commission', () => {
        expect(migration).toContain('ADD COLUMN gross_supplier_commission');
        expect(migration).toContain('ADD COLUMN commercial_net_amount');
        expect(migration).toContain('ADD COLUMN franchise_royalty_amount');
        expect(migration).toContain('ADD COLUMN central_remainder_amount');
        expect(migration).toContain('network_commissions_allocation_balanced_check');
        expect(migration).toContain('prevent_frozen_commission_change');
    });

    it('uses an append-only ledger and reviewable adjustments', () => {
        expect(migration).toContain('CREATE TABLE public.commission_events');
        expect(migration).toContain('CREATE TABLE public.commission_adjustments');
        expect(migration).toContain('prevent_commission_events_mutation');
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.propose_commission_adjustment');
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.resolve_commission_adjustment');
    });

    it('moves eligibility from canonical contract activation', () => {
        expect(migration).toContain('mark_commission_eligible_on_contract_activation');
        expect(migration).toContain("SET lifecycle_status = 'eligible'");
        expect(migration).toContain("NEW.status <> 'active'");
    });

    it('keeps mutation workflows service-only and RLS-protected', () => {
        for (const table of [
            'commission_plans',
            'commission_plan_assignments',
            'commission_decommission_policies',
            'commission_events',
            'commission_adjustments',
        ]) {
            expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
        }

        expect(migration).toContain(
            'REVOKE ALL ON FUNCTION public.assign_commission_plan(uuid,uuid,uuid,text,timestamptz) FROM PUBLIC, anon, authenticated',
        );
        expect(migration).toContain(
            'GRANT EXECUTE ON FUNCTION public.assign_commission_plan(uuid,uuid,uuid,text,timestamptz) TO service_role',
        );
        expect(migration).not.toMatch(
            /GRANT EXECUTE ON FUNCTION public\.(assign_commission_plan|initialize_commission_lifecycle|transition_commission_lifecycle|propose_commission_adjustment|resolve_commission_adjustment)[^;]*TO authenticated/i,
        );
    });

    it('routes legacy ambiguity to reconciliation without fabricating allocations', () => {
        expect(migration).toContain("'contradictory_legacy'");
        expect(migration).toContain("'pending_review'");
        expect(migration).toContain('CREATE OR REPLACE VIEW public.commission_reconciliation_queue');
        expect(migration).not.toMatch(/UPDATE public\.network_commissions[\s\S]*?SET gross_supplier_commission\s*=\s*agent_commission/i);
    });

    it('configures both channels and direct partners atomically through service role only', () => {
        expect(configurationMigration).toContain(
            'CREATE OR REPLACE FUNCTION public.configure_commission_model',
        );
        expect(configurationMigration).toContain("'partner_direct'");
        expect(configurationMigration).toContain("'franchise_network'");
        expect(configurationMigration).toContain('p_direct_commercial_share_bps <= p_franchise_commercial_share_bps');
        expect(configurationMigration).toContain('direct_central_bps >= franchise_central_bps');
        expect(configurationMigration).toContain('requested_count > 5');
        expect(configurationMigration).toContain('pg_advisory_xact_lock');
        expect(configurationMigration).toContain('TO service_role');
        expect(configurationMigration).toContain('FROM PUBLIC, anon, authenticated');
        expect(configurationMigration).not.toMatch(
            /GRANT EXECUTE ON FUNCTION public\.configure_commission_model[^;]*TO authenticated/i,
        );
        expect(configurationFixMigration).toContain(
            'commercial_id, plan_id, effective_from, assigned_by, reason',
        );
        expect(configurationFixMigration).toContain(
            'selected_commercial_id, direct_plan_id, effective_at, p_actor_id',
        );
        expect(configurationFixMigration).not.toContain(
            'selected_commercial_id,\n            plan_id',
        );
    });

    it('creates immutable marketer policy versions with complete non-increasing bands', () => {
        expect(decommissionPolicyMigration).toContain(
            'CREATE OR REPLACE FUNCTION public.configure_decommission_policy',
        );
        expect(decommissionPolicyMigration).toContain('expected_day_from <> p_clawback_days + 1');
        expect(decommissionPolicyMigration).toContain('reversal_bps > previous_reversal_bps');
        expect(decommissionPolicyMigration).toContain('jsonb_array_length(p_bands) NOT BETWEEN 1 AND 12');
        expect(decommissionPolicyMigration).toContain('pg_advisory_xact_lock');
        expect(decommissionPolicyMigration).toContain('FROM PUBLIC, anon, authenticated');
        expect(decommissionPolicyMigration).toContain('TO service_role');
        expect(decommissionPolicyMigration).not.toMatch(
            /GRANT EXECUTE ON FUNCTION public\.configure_decommission_policy[^;]*TO authenticated/i,
        );
    });

    it('versions future percentages atomically without recalculating frozen commissions', () => {
        expect(proportionalPermanenceMigration).toContain(
            'CREATE UNIQUE INDEX commission_plans_one_active_code_idx',
        );
        expect(proportionalPermanenceMigration).toContain(
            'CREATE OR REPLACE FUNCTION public.version_commission_plan',
        );
        expect(proportionalPermanenceMigration).toContain(
            'Actualización de porcentajes del canal económico',
        );
        expect(proportionalPermanenceMigration).toContain(
            'IF commission.plan_snapshot IS NOT NULL THEN',
        );
    });

    it('derives proportional permanence reversals from canonical contract dates', () => {
        expect(proportionalPermanenceMigration).toContain(
            'CREATE OR REPLACE FUNCTION public.propose_permanence_decommission',
        );
        expect(proportionalPermanenceMigration).toContain(
            'remaining_days * 10000.0 / total_days',
        );
        expect(proportionalPermanenceMigration).toContain(
            "contract.permanence_status <> 'known'",
        );
        expect(proportionalPermanenceMigration).toContain(
            "'customer_penalty_independent', true",
        );
        expect(proportionalPermanenceMigration).toContain(
            'FROM PUBLIC, anon, authenticated',
        );
        expect(proportionalPermanenceMigration).toContain('TO service_role');
    });
});
