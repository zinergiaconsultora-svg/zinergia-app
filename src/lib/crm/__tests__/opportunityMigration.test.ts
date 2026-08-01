import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
    resolve(
        process.cwd(),
        'supabase/migrations/20260730203000_crm_opportunity_foundation.sql',
    ),
    'utf8',
);

const privilegeHardeningMigration = readFileSync(
    resolve(
        process.cwd(),
        'supabase/migrations/20260731013000_restrict_opportunity_service_privileges.sql',
    ),
    'utf8',
);

const legacyBackfill = readFileSync(
    resolve(
        process.cwd(),
        'supabase/scripts/20260731_backfill_crm_opportunities.sql',
    ),
    'utf8',
);

const ambiguityReport = readFileSync(
    resolve(
        process.cwd(),
        'supabase/scripts/report_crm_opportunity_backfill_ambiguities.sql',
    ),
    'utf8',
);

const transitionMigration = readFileSync(
    resolve(
        process.cwd(),
        'supabase/migrations/20260731020000_opportunity_transition_rpc.sql',
    ),
    'utf8',
);

const workQueueMigration = readFileSync(
    resolve(
        process.cwd(),
        'supabase/migrations/20260731021246_crm_work_queue.sql',
    ),
    'utf8',
);

const workQueueRlsVerification = readFileSync(
    resolve(
        process.cwd(),
        'supabase/scripts/verify_crm_work_queue_rls.sql',
    ),
    'utf8',
);

const ocrOpportunityMigration = readFileSync(
    resolve(
        process.cwd(),
        'supabase/migrations/20260731103431_crm_ocr_opportunity_workflow.sql',
    ),
    'utf8',
);

const workQueueOwnerMigration = readFileSync(
    resolve(
        process.cwd(),
        'supabase/migrations/20260731111232_crm_work_queue_owner_name.sql',
    ),
    'utf8',
);

const proposalWorkflowMigration = readFileSync(
    resolve(
        process.cwd(),
        'supabase/migrations/20260731162336_crm_proposal_opportunity_workflow.sql',
    ),
    'utf8',
);

const acceptanceIntegrityMigration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260731181410_proposal_acceptance_integrity.sql'),
    'utf8',
);

const acceptanceIntegrityAdminHelperMigration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260731224153_fix_acceptance_integrity_admin_helper.sql'),
    'utf8',
);

const activationMigration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260731191249_complete_crm_activation.sql'),
    'utf8',
);

const renewalMigration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260731194241_canonical_contract_renewals.sql'),
    'utf8',
);

describe('CRM opportunity foundation migration contract', () => {
    it('creates the canonical opportunity and append-only history tables', () => {
        expect(migration).toContain('CREATE TABLE public.opportunities');
        expect(migration).toContain('CREATE TABLE public.opportunity_stage_history');
        expect(migration).toContain('opportunity_history_append_only');
        expect(migration).toContain('prevent_opportunity_history_mutation');
    });

    it('links operational records without pretending proposals_alta is a table', () => {
        for (const table of [
            'public.ocr_jobs',
            'public.proposals',
            'public.contracts',
            'public.network_commissions',
            'public.tasks',
        ]) {
            expect(migration).toContain(`ALTER TABLE ${table}`);
        }

        expect(migration).not.toContain('ALTER TABLE public.proposals_alta');
        expect(migration).toContain('proposals_opportunity_client_fkey');
        expect(migration).toContain('contracts_opportunity_client_fkey');
        expect(migration).toContain('ocr_jobs_supply_point_client_fkey');
    });

    it('enforces renewal, contract and commission idempotency foundations', () => {
        expect(migration).toContain('opportunities_one_renewal_per_contract');
        expect(migration).toContain('contracts_one_per_proposal_idx');
        expect(migration).toContain('network_commissions_opportunity_fkey');
    });

    it('enables RLS and keeps browser-authenticated writes revoked', () => {
        expect(migration).toContain(
            'ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY',
        );
        expect(migration).toContain(
            'ALTER TABLE public.opportunity_stage_history ENABLE ROW LEVEL SECURITY',
        );
        expect(migration).toContain(
            'GRANT SELECT ON public.opportunities TO authenticated',
        );
        expect(migration).toContain(
            'GRANT SELECT ON public.opportunity_stage_history TO authenticated',
        );
        expect(migration).toContain(
            'GRANT SELECT, INSERT ON public.opportunity_stage_history TO service_role',
        );
        expect(migration).not.toMatch(
            /GRANT\s+ALL\s+ON\s+public\.opportunity_stage_history/i,
        );
        expect(migration).not.toMatch(
            /GRANT\s+(INSERT|UPDATE|DELETE|ALL)[^;]*\sTO\s+authenticated/i,
        );
        expect(privilegeHardeningMigration).toContain(
            'REVOKE ALL ON public.opportunity_stage_history FROM service_role',
        );
        expect(privilegeHardeningMigration).toContain(
            'GRANT SELECT, INSERT ON public.opportunity_stage_history TO service_role',
        );
        expect(privilegeHardeningMigration).not.toMatch(
            /GRANT\s+(UPDATE|DELETE|TRUNCATE|ALL)[^;]*opportunity_stage_history/i,
        );
    });

    it('adds explicit OCR confirmation and contract permanence state', () => {
        expect(migration).toContain('ADD COLUMN confirmed_at timestamptz');
        expect(migration).toContain('ADD COLUMN confirmed_by uuid');
        expect(migration).toContain('ADD COLUMN permanence_status text');
        expect(migration).toContain("permanence_status IN ('known', 'none', 'unknown')");
    });

    it('keeps legacy backfill deterministic, idempotent and PII-independent', () => {
        expect(legacyBackfill).toContain('BEGIN;');
        expect(legacyBackfill).toContain('COMMIT;');
        expect(legacyBackfill).toContain('supply.supply_count = 1');
        expect(legacyBackfill).toContain('proposal.id AS proposal_id');
        expect(legacyBackfill).toContain('ON CONFLICT (id) DO NOTHING');
        expect(legacyBackfill).toContain("'legacy_backfill'");
        expect(legacyBackfill).not.toMatch(/\bcups(_ciphertext|_hash)?\b/i);
        expect(legacyBackfill).not.toMatch(/\bdni(_cif)?\b/i);
        expect(ambiguityReport).toContain('proposal_id');
        expect(ambiguityReport).toContain("'missing_supply_point'");
        expect(ambiguityReport).not.toMatch(/\b(name|email|phone|address)\b/i);
        expect(ambiguityReport).not.toMatch(/\bcups(_ciphertext|_hash)?\b/i);
        expect(ambiguityReport).not.toMatch(/\bdni(_cif)?\b/i);
    });

    it('keeps opportunity transitions atomic and service-only', () => {
        expect(transitionMigration).toContain('FOR UPDATE');
        expect(transitionMigration).toContain('opportunity stage changed');
        expect(transitionMigration).toContain(
            'INSERT INTO public.opportunity_stage_history',
        );
        expect(transitionMigration).toContain(
            ') FROM PUBLIC, anon, authenticated',
        );
        expect(transitionMigration).toContain(') TO service_role');
        expect(transitionMigration).toContain(
            "p_safe_metadata::text ~* '\"(cups|dni|nif|cif|iban|email|phone|address|name|signature|token|public_token)\"",
        );
    });

    it('creates a read-only RLS-aware CRM work queue without sensitive fields', () => {
        expect(workQueueMigration).toContain('CREATE VIEW public.crm_work_queue');
        expect(workQueueMigration).toContain('security_invoker = true');
        expect(workQueueMigration).toContain('WHERE opportunity.closed_at IS NULL');
        expect(workQueueMigration).toContain('GRANT SELECT ON public.crm_work_queue TO authenticated');
        expect(workQueueMigration).not.toMatch(
            /\b(cups_ciphertext|cups_hash|dni|email|phone|address|public_token|signature)\b/i,
        );
        expect(workQueueMigration).not.toMatch(
            /GRANT\s+(INSERT|UPDATE|DELETE|ALL)[^;]*crm_work_queue/i,
        );
        expect(workQueueRlsVerification).toContain('SET LOCAL ROLE authenticated');
        expect(workQueueRlsVerification).toContain("SET role = 'franchise'");
        expect(workQueueRlsVerification).toContain('ROLLBACK;');
    });

    it('reconciles completed OCR jobs atomically without passing plaintext identity', () => {
        expect(ocrOpportunityMigration).toContain(
            'CREATE OR REPLACE FUNCTION public.reconcile_crm_ocr_opportunity',
        );
        expect(ocrOpportunityMigration).toContain('pg_advisory_xact_lock');
        expect(ocrOpportunityMigration).toContain('FOR UPDATE');
        expect(ocrOpportunityMigration).toContain('existing_client.owner_id');
        expect(ocrOpportunityMigration).toContain(
            "candidate.type = 'switch'",
        );
        expect(ocrOpportunityMigration).toContain(
            'UPDATE public.ocr_jobs',
        );
        expect(ocrOpportunityMigration).toContain(
            'INSERT INTO public.opportunity_stage_history',
        );
        expect(ocrOpportunityMigration).not.toMatch(
            /p_(cups|dni_cif)\s+text/i,
        );
    });

    it('keeps OCR reconciliation and confirmation service-only', () => {
        expect(ocrOpportunityMigration).toContain(
            'CREATE OR REPLACE FUNCTION public.confirm_crm_ocr_data',
        );
        expect(ocrOpportunityMigration).toContain(
            ') FROM PUBLIC, anon, authenticated',
        );
        expect(ocrOpportunityMigration).toContain(') TO service_role');
        expect(ocrOpportunityMigration).toContain(
            "job.status <> 'completed'",
        );
        expect(ocrOpportunityMigration).toContain(
            "opportunity.stage <> 'data_review'",
        );
        expect(ocrOpportunityMigration).toContain(
            'confirmed_by = p_actor_id',
        );
    });

    it('adds only the safe owner label to the canonical work queue', () => {
        expect(workQueueOwnerMigration).toContain(
            'CREATE OR REPLACE VIEW public.crm_work_queue',
        );
        expect(workQueueOwnerMigration).toContain('owner.full_name');
        expect(workQueueOwnerMigration).toContain('AS owner_name');
        expect(workQueueOwnerMigration).not.toMatch(
            /owner\.(email|phone)|cups_ciphertext|dni_cif/i,
        );
        expect(workQueueOwnerMigration).toContain(
            'WITH (security_invoker = true, security_barrier = true)',
        );
    });

    it('sends and accepts proposals atomically inside one canonical opportunity', () => {
        expect(proposalWorkflowMigration).toContain(
            'CREATE OR REPLACE FUNCTION public.send_crm_proposal',
        );
        expect(proposalWorkflowMigration).toContain(
            'CREATE OR REPLACE FUNCTION public.accept_crm_public_proposal',
        );
        expect(proposalWorkflowMigration.match(/FOR UPDATE/g)?.length).toBeGreaterThanOrEqual(4);
        expect(proposalWorkflowMigration).toContain("proposal.agent_id IS DISTINCT FROM opportunity.owner_id");
        expect(proposalWorkflowMigration).toContain("proposal.supply_point_id IS DISTINCT FROM opportunity.supply_point_id");
        expect(proposalWorkflowMigration).toContain("result_outcome := 'already_accepted'");
        expect(proposalWorkflowMigration).toContain("reason_code");
        expect(proposalWorkflowMigration).toContain("'public_acceptance'");
        expect(proposalWorkflowMigration).toContain(
            'FROM PUBLIC, anon, authenticated',
        );
        expect(proposalWorkflowMigration).toContain('TO service_role');
    });

    it('keeps sensitive public acceptance data out of stage history', () => {
        const historyMetadata = proposalWorkflowMigration.match(
            /INSERT INTO public\.opportunity_stage_history[\s\S]*?\);/g,
        ) ?? [];

        expect(historyMetadata.length).toBeGreaterThan(0);
        for (const insert of historyMetadata) {
            expect(insert).not.toMatch(/p_(public_token|signature_data|signed_name)/i);
        }
    });

    it('creates an admin-only non-PII acceptance integrity queue and protected retry', () => {
        expect(acceptanceIntegrityMigration).toContain('CREATE VIEW public.proposal_acceptance_integrity');
        expect(acceptanceIntegrityMigration).toContain('security_invoker = true');
        expect(acceptanceIntegrityMigration).toContain('security_barrier = true');
        expect(acceptanceIntegrityMigration).toContain('public.is_superadmin()');
        expect(acceptanceIntegrityMigration).toContain('missing_activation');
        expect(acceptanceIntegrityMigration).toContain('missing_commission');
        expect(acceptanceIntegrityMigration).toContain('missing_contract');
        expect(acceptanceIntegrityMigration).toContain('FOR UPDATE');
        expect(acceptanceIntegrityMigration).toContain("'acceptance_reconciliation'");
        expect(acceptanceIntegrityMigration).toContain('FROM PUBLIC, anon, authenticated');
        expect(acceptanceIntegrityMigration).not.toMatch(/\b(cups|dni|email|phone|signature_data|public_token)\b/i);
    });

    it('uses the executable private admin helper in the acceptance integrity view', () => {
        expect(acceptanceIntegrityAdminHelperMigration).toContain(
            'CREATE OR REPLACE VIEW public.proposal_acceptance_integrity',
        );
        expect(acceptanceIntegrityAdminHelperMigration).toContain(
            '(select private.is_superadmin())',
        );
        expect(acceptanceIntegrityAdminHelperMigration).not.toContain(
            'public.is_superadmin()',
        );
        expect(acceptanceIntegrityAdminHelperMigration).toContain(
            'GRANT SELECT ON public.proposal_acceptance_integrity TO authenticated',
        );
        expect(acceptanceIntegrityAdminHelperMigration).not.toMatch(
            /GRANT\s+SELECT[^;]*\sTO\s+anon/i,
        );
    });

    it('completes activation as one admin-only atomic workflow', () => {
        const activationFunction = activationMigration.slice(
            activationMigration.indexOf('CREATE OR REPLACE FUNCTION public.complete_crm_activation'),
        );

        expect(activationMigration).toContain('CREATE OR REPLACE FUNCTION public.complete_crm_activation');
        expect(activationMigration.match(/FOR UPDATE/g)?.length).toBeGreaterThanOrEqual(2);
        expect(activationMigration).toContain("actor.role = 'admin'");
        expect(activationMigration).toContain("proposal.alta_status <> 'en_alta'");
        expect(activationMigration).toContain("opportunity.stage <> 'activation'");
        expect(activationMigration).toContain("p_permanence_status NOT IN ('known', 'none', 'unknown')");
        expect(activationMigration).toContain('ON CONFLICT (proposal_id) WHERE proposal_id IS NOT NULL');
        expect(activationMigration).toContain("'activation', 'won', p_actor_id");
        expect(activationMigration).toContain("SET status = 'won'");
        expect(activationMigration).toContain("'contract_activated'");
        expect(activationMigration).toContain('FROM PUBLIC, anon, authenticated');
        expect(activationMigration).toContain('TO service_role');
        expect(activationFunction).not.toMatch(/\b(cups|dni|email|phone|signature_data|public_token)\b/i);
    });

    it('creates idempotent contract renewals and durable reminders', () => {
        expect(renewalMigration).toContain('CREATE OR REPLACE FUNCTION public.reconcile_contract_renewals');
        expect(renewalMigration).toContain('FOR UPDATE SKIP LOCKED');
        expect(renewalMigration).toContain("contract.end_date <= p_as_of + 60");
        expect(renewalMigration).toContain("'renewal', renewal_stage, 'contract_expiry'");
        expect(renewalMigration).toContain('ON CONFLICT DO NOTHING');
        expect(renewalMigration).toContain('PRIMARY KEY (contract_id, threshold_days)');
        expect(renewalMigration).toContain('CHECK (threshold_days IN (0, 7, 30, 60))');
        expect(renewalMigration).toContain('CREATE VIEW public.contract_renewal_data_quality');
        expect(renewalMigration).toContain("contract.permanence_status = 'unknown'");
        expect(renewalMigration).toContain('FROM PUBLIC, anon, authenticated');
        expect(renewalMigration).toContain('TO service_role');
        expect(renewalMigration).not.toMatch(/\b(cups_ciphertext|cups_hash|dni|email|phone|signature_data|public_token)\b/i);
    });
});
