CREATE TABLE public.package_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL,
  plan_name text NOT NULL,
  amount_cents integer NOT NULL,
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  buyer_cpf text NOT NULL,
  buyer_phone text,
  status text NOT NULL DEFAULT 'pending',
  asaas_customer_id text,
  asaas_payment_id text,
  invoice_url text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.package_orders TO service_role;
ALTER TABLE public.package_orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.asaas_events (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.asaas_events TO service_role;
ALTER TABLE public.asaas_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  starts_at timestamptz NOT NULL UNIQUE,
  ends_at timestamptz NOT NULL,
  google_event_id text,
  meet_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;