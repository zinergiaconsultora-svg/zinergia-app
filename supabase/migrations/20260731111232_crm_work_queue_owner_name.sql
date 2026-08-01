-- Add the safe operational owner label required by the simplified queue.
-- Existing columns keep their order so CREATE OR REPLACE remains compatible.

CREATE OR REPLACE VIEW public.crm_work_queue
WITH (security_invoker = true, security_barrier = true) AS
SELECT
    opportunity.id AS opportunity_id,
    opportunity.client_id,
    opportunity.supply_point_id,
    opportunity.owner_id,
    opportunity.franchise_id,
    opportunity.type,
    opportunity.stage,
    client.name AS client_name,
    concat(
        CASE supply.supply_type
            WHEN 'electricity' THEN 'Electricidad'
            WHEN 'gas' THEN 'Gas'
            ELSE 'Suministro'
        END,
        CASE
            WHEN supply.cups_last4 IS NULL THEN ''
            ELSE ' · ' || supply.cups_last4
        END
    ) AS supply_label,
    opportunity.stage_entered_at,
    greatest(
        0,
        floor(
            extract(epoch FROM (now() - opportunity.stage_entered_at)) / 86400
        )::integer
    ) AS stage_age_days,
    opportunity.next_action_type,
    opportunity.next_action_title,
    opportunity.next_action_due_at,
    CASE
        WHEN opportunity.next_action_due_at IS NULL THEN 'no_date'
        WHEN opportunity.next_action_due_at::date < current_date THEN 'overdue'
        WHEN opportunity.next_action_due_at::date = current_date THEN 'today'
        ELSE 'upcoming'
    END AS due_group,
    coalesce(nullif(btrim(owner.full_name), ''), 'Sin nombre') AS owner_name
FROM public.opportunities opportunity
JOIN public.clients client
  ON client.id = opportunity.client_id
JOIN public.supply_points supply
  ON supply.id = opportunity.supply_point_id
 AND supply.client_id = opportunity.client_id
JOIN public.profiles owner
  ON owner.id = opportunity.owner_id
WHERE opportunity.closed_at IS NULL;

REVOKE ALL ON public.crm_work_queue FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.crm_work_queue TO authenticated;
GRANT SELECT ON public.crm_work_queue TO service_role;

COMMENT ON VIEW public.crm_work_queue IS
    'RLS-aware, read-only operational queue for open CRM opportunities. Exposes a safe owner label and no contact or protected identity fields.';
