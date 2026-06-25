-- Guard against incoherent lead state transitions.
-- Prevents: closing+losing simultaneously, closing without OCR, etc.

CREATE OR REPLACE FUNCTION public.guard_lead_state_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Cannot be both closed and lost at the same time
    IF NEW.closed = true AND NEW.lost = true THEN
        RAISE EXCEPTION 'Lead cannot be both closed (won) and lost simultaneously'
            USING ERRCODE = 'check_violation';
    END IF;

    -- Cannot close (won) a lead that never completed OCR
    IF NEW.closed = true AND OLD.closed IS DISTINCT FROM true
       AND NEW.status = 'processing' THEN
        RAISE EXCEPTION 'Cannot close a lead that is still processing OCR'
            USING ERRCODE = 'check_violation';
    END IF;

    -- Cannot mark as lost a lead that is still processing OCR
    IF NEW.lost = true AND OLD.lost IS DISTINCT FROM true
       AND NEW.status = 'processing' THEN
        RAISE EXCEPTION 'Cannot mark as lost a lead that is still processing OCR'
            USING ERRCODE = 'check_violation';
    END IF;

    -- When closing, enforce closed_at timestamp
    IF NEW.closed = true AND NEW.closed_at IS NULL THEN
        NEW.closed_at := now();
    END IF;

    -- When marking lost, enforce lost_at timestamp
    IF NEW.lost = true AND NEW.lost_at IS NULL THEN
        NEW.lost_at := now();
    END IF;

    -- When reopening (clearing both closed and lost), clean up related fields
    IF NEW.closed = false AND NEW.lost = false
       AND (OLD.closed = true OR OLD.lost = true) THEN
        NEW.closed_at := NULL;
        NEW.lost_at := NULL;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_lead_state ON public.ocr_jobs;
CREATE TRIGGER trg_guard_lead_state
    BEFORE UPDATE ON public.ocr_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_lead_state_transition();
