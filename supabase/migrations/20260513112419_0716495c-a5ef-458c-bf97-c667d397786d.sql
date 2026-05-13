-- Hide compensation columns (fee_amount, paid_at) from non-privileged users.
-- Office/admin keep full visibility via SECURITY DEFINER context not used here, so
-- we instead rely on column-level privileges: revoke from authenticated, explicitly
-- grant nothing else. Office/admin users will still see these columns because the
-- service role bypasses column privileges in edge functions / admin tooling.
REVOKE SELECT (fee_amount, paid_at) ON public.referrals FROM authenticated;
REVOKE SELECT (fee_amount, paid_at) ON public.referrals FROM anon;

-- Re-grant SELECT on the remaining columns to authenticated so the existing
-- "Users view own referrals" / "Office admin view all referrals" RLS policies
-- continue to work for referrers and office staff.
GRANT SELECT (
  id, referrer_user_id, referrer_name, type, status,
  referee_name, referee_phone, referee_email, relationship, notes,
  created_at, updated_at
) ON public.referrals TO authenticated;