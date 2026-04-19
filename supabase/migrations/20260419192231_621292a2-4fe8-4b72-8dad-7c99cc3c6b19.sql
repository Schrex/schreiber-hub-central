-- Enums for referral type and status
CREATE TYPE public.referral_type AS ENUM ('hire', 'job');
CREATE TYPE public.referral_status AS ENUM ('new', 'reviewing', 'hired_won', 'paid', 'closed', 'rejected');

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  referrer_name text,
  type public.referral_type NOT NULL,
  status public.referral_status NOT NULL DEFAULT 'new',
  referee_name text NOT NULL,
  referee_phone text,
  referee_email text,
  relationship text,
  notes text,
  fee_amount numeric(10,2),
  paid_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Submitters
CREATE POLICY "Users insert own referrals"
  ON public.referrals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = referrer_user_id);

CREATE POLICY "Users view own referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_user_id);

-- Office / admin full access
CREATE POLICY "Office admin view all referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admin update referrals"
  ON public.referrals FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admin delete referrals"
  ON public.referrals FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'office'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX idx_referrals_status ON public.referrals(status);
CREATE INDEX idx_referrals_type ON public.referrals(type);