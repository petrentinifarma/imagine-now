ALTER TABLE public.health_intakes
  ADD COLUMN request_id UUID,
  ADD COLUMN privacy_notice_version TEXT,
  ADD COLUMN privacy_acknowledged_at TIMESTAMPTZ;

UPDATE public.health_intakes
SET request_id = gen_random_uuid()
WHERE request_id IS NULL;

ALTER TABLE public.health_intakes
  ALTER COLUMN request_id SET NOT NULL,
  ADD CONSTRAINT health_intakes_request_id_unique UNIQUE (request_id),
  ADD CONSTRAINT health_intakes_profession_length
    CHECK (profession IS NULL OR char_length(profession) BETWEEN 1 AND 120),
  ADD CONSTRAINT health_intakes_complaint_details_length
    CHECK (complaint_details IS NULL OR char_length(complaint_details) <= 3000),
  ADD CONSTRAINT health_intakes_improvement_answers_size
    CHECK (octet_length(improvement_answers::text) <= 16000),
  ADD CONSTRAINT health_intakes_privacy_notice_version_length
    CHECK (privacy_notice_version IS NULL OR char_length(privacy_notice_version) BETWEEN 1 AND 40),
  ADD CONSTRAINT health_intakes_privacy_ack_pair
    CHECK (
      (privacy_notice_version IS NULL AND privacy_acknowledged_at IS NULL)
      OR (privacy_notice_version IS NOT NULL AND privacy_acknowledged_at IS NOT NULL)
    );

DROP POLICY IF EXISTS "Anyone can submit a health intake" ON public.health_intakes;
REVOKE INSERT ON public.health_intakes FROM anon, authenticated;
REVOKE ALL ON public.health_intakes FROM PUBLIC;
GRANT ALL ON public.health_intakes TO service_role;

CREATE TABLE public.health_intake_submission_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT NOT NULL CHECK (char_length(ip_hash) = 64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX health_intake_submission_attempts_lookup
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
  IF char_length(p_ip_hash) <> 64 THEN
    RETURN FALSE;
  END IF;

  -- Serialize checks for the same pseudonymous fingerprint so parallel
  -- requests cannot race past the limit.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));

  DELETE FROM public.health_intake_submission_attempts
  WHERE created_at < now() - interval '24 hours';

  SELECT count(*)
  INTO recent_attempts
  FROM public.health_intake_submission_attempts
  WHERE ip_hash = p_ip_hash
    AND created_at >= now() - interval '15 minutes';

  IF recent_attempts >= 5 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.health_intake_submission_attempts (ip_hash)
  VALUES (p_ip_hash);

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.register_health_intake_attempt(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_health_intake_attempt(TEXT) TO service_role;

COMMENT ON TABLE public.health_intake_submission_attempts IS
  'Short-lived pseudonymous request fingerprints used only to rate-limit health intake submissions.';
