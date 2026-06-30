-- Link simulator proposals back to the OCR job that produced them.
-- This is nullable so existing/manual proposals remain valid.

ALTER TABLE public.proposals
    ADD COLUMN IF NOT EXISTS ocr_job_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'proposals_ocr_job_id_fkey'
          AND conrelid = 'public.proposals'::regclass
    ) THEN
        ALTER TABLE public.proposals
            ADD CONSTRAINT proposals_ocr_job_id_fkey
            FOREIGN KEY (ocr_job_id)
            REFERENCES public.ocr_jobs(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_proposals_ocr_job_id
    ON public.proposals(ocr_job_id)
    WHERE ocr_job_id IS NOT NULL;

COMMENT ON COLUMN public.proposals.ocr_job_id IS
    'Originating OCR job that produced this simulator proposal, when available.';
