ALTER TABLE public.health_intakes
  ADD COLUMN IF NOT EXISTS request_id UUID,
  ADD COLUMN IF NOT EXISTS privacy_notice_version TEXT,
  ADD COLUMN IF NOT EXISTS privacy_acknowledged_at TIMESTAMPTZ;

UPDATE public.health_intakes
SET request_id = gen_random_uuid()
WHERE request_id IS NULL;

ALTER TABLE public.health_intakes ALTER COLUMN request_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.health_intakes'::regclass AND conname = 'health_intakes_request_id_unique') THEN
    ALTER TABLE public.health_intakes ADD CONSTRAINT health_intakes_request_id_unique UNIQUE (request_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.health_intakes'::regclass AND conname = 'health_intakes_profession_length') THEN
    ALTER TABLE public.health_intakes ADD CONSTRAINT health_intakes_profession_length CHECK (profession IS NULL OR char_length(profession) BETWEEN 1 AND 120);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.health_intakes'::regclass AND conname = 'health_intakes_complaint_details_length') THEN
    ALTER TABLE public.health_intakes ADD CONSTRAINT health_intakes_complaint_details_length CHECK (complaint_details IS NULL OR char_length(complaint_details) <= 3000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.health_intakes'::regclass AND conname = 'health_intakes_improvement_answers_size') THEN
    ALTER TABLE public.health_intakes ADD CONSTRAINT health_intakes_improvement_answers_size CHECK (octet_length(improvement_answers::text) <= 16000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.health_intakes'::regclass AND conname = 'health_intakes_privacy_notice_version_length') THEN
    ALTER TABLE public.health_intakes ADD CONSTRAINT health_intakes_privacy_notice_version_length CHECK (privacy_notice_version IS NULL OR char_length(privacy_notice_version) BETWEEN 1 AND 40);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.health_intakes'::regclass AND conname = 'health_intakes_privacy_ack_pair') THEN
    ALTER TABLE public.health_intakes ADD CONSTRAINT health_intakes_privacy_ack_pair CHECK ((privacy_notice_version IS NULL AND privacy_acknowledged_at IS NULL) OR (privacy_notice_version IS NOT NULL AND privacy_acknowledged_at IS NOT NULL));
  END IF;
END $$;

DROP POLICY IF EXISTS "Anyone can submit a health intake" ON public.health_intakes;
REVOKE ALL ON public.health_intakes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.health_intakes TO service_role;

CREATE TABLE IF NOT EXISTS public.health_intake_submission_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT NOT NULL CHECK (char_length(ip_hash) = 64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS health_intake_submission_attempts_lookup
  ON public.health_intake_submission_attempts (ip_hash, created_at DESC);

ALTER TABLE public.health_intake_submission_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.health_intake_submission_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.health_intake_submission_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.register_health_intake_attempt(p_ip_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_attempts INTEGER;
BEGIN
  IF char_length(p_ip_hash) <> 64 THEN RETURN FALSE; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));
  DELETE FROM public.health_intake_submission_attempts WHERE created_at < now() - interval '24 hours';
  SELECT count(*) INTO recent_attempts FROM public.health_intake_submission_attempts
    WHERE ip_hash = p_ip_hash AND created_at >= now() - interval '15 minutes';
  IF recent_attempts >= 5 THEN RETURN FALSE; END IF;
  INSERT INTO public.health_intake_submission_attempts (ip_hash) VALUES (p_ip_hash);
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.register_health_intake_attempt(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_health_intake_attempt(TEXT) TO service_role;

COMMENT ON TABLE public.health_intake_submission_attempts IS
  'Short-lived pseudonymous request fingerprints used only to rate-limit health intake submissions.';

NOTIFY pgrst, 'reload schema';