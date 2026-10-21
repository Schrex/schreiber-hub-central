-- Unapplied candidate. Rehearsal review only; does not activate this trigger.
-- UPDATE OF tests original SET columns, not changes made by BEFORE triggers.
-- Compare effective row values instead, preserving current name/status authority.
DROP TRIGGER trg_sync_contact_to_profile ON public.employee_contacts;
CREATE TRIGGER trg_sync_contact_to_profile
AFTER UPDATE ON public.employee_contacts
FOR EACH ROW
WHEN (OLD.name IS DISTINCT FROM NEW.name
   OR OLD.email IS DISTINCT FROM NEW.email
   OR OLD.converted_user_id IS DISTINCT FROM NEW.converted_user_id)
EXECUTE FUNCTION public.sync_contact_to_profile();
ALTER TABLE public.employee_contacts DISABLE TRIGGER trg_sync_contact_to_profile;
