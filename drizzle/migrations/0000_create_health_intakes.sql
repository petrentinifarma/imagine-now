CREATE TABLE public.health_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  patient_name TEXT NOT NULL CHECK (char_length(patient_name) BETWEEN 2 AND 120),
  age INTEGER NOT NULL CHECK (age BETWEEN 18 AND 120),
  weight_kg NUMERIC(5,2) CHECK (weight_kg > 0 AND weight_kg <= 400),
  profession TEXT,
  phone TEXT NOT NULL CHECK (char_length(phone) BETWEEN 8 AND 24),
  main_complaint TEXT NOT NULL CHECK (char_length(main_complaint) BETWEEN 3 AND 3000),
  complaint_details TEXT,
  complaint_score SMALLINT CHECK (complaint_score BETWEEN 0 AND 10),
  improvement_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  pain_average NUMERIC(4,2) CHECK (pain_average BETWEEN 0 AND 10),
  health_average NUMERIC(4,2) CHECK (health_average BETWEEN 0 AND 10)
);

GRANT INSERT ON public.health_intakes TO anon;
GRANT INSERT ON public.health_intakes TO authenticated;
GRANT ALL ON public.health_intakes TO service_role;

ALTER TABLE public.health_intakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a health intake"
ON public.health_intakes
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

COMMENT ON TABLE public.health_intakes IS 'Private health intake submissions; never publicly readable.';