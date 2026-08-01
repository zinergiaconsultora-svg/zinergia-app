-- Target: staging/production preflight for proposal opportunity rollout.
-- Safe identifiers and workflow state only; no PII.

SELECT
    proposal.id AS proposal_id,
    proposal.status,
    proposal.ocr_job_id,
    proposal.supply_point_id,
    job.opportunity_id AS ocr_opportunity_id,
    opportunity.stage AS ocr_opportunity_stage,
    CASE
        WHEN proposal.ocr_job_id IS NULL THEN 'missing_ocr_link'
        WHEN job.id IS NULL THEN 'missing_ocr_job'
        WHEN job.opportunity_id IS NULL THEN 'ocr_without_opportunity'
        WHEN job.client_id IS DISTINCT FROM proposal.client_id THEN 'client_mismatch'
        WHEN job.agent_id IS DISTINCT FROM proposal.agent_id THEN 'owner_mismatch'
        ELSE 'reconcilable'
    END AS resolution
FROM public.proposals proposal
LEFT JOIN public.ocr_jobs job ON job.id = proposal.ocr_job_id
LEFT JOIN public.opportunities opportunity ON opportunity.id = job.opportunity_id
WHERE proposal.status IN ('sent', 'accepted')
  AND proposal.opportunity_id IS NULL
ORDER BY proposal.created_at;
