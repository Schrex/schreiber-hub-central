# Add Employee release scope

Status: implementation candidate only; production execution is not authorized.
Target backend is **acgqjjbrnkmeazswdnzp (PRODUCTION)**. The historical project ID
in supabase/config.toml is not the target; always specify the reviewed project.

## Behavior

Admin, office and foreman can add directory contacts. Only admins can add an
optional login, select employee/foreman/office/admin, and optionally assign an
active position and nonnegative pay rate. Position ranges remain guidance, as in
the existing form; this change does not introduce a new range restriction.

Login creation uses an admin-entered initial password (8+ characters), confirms
the email immediately, and sends no invitation. The administrator shares the
password privately. First-login password change is advised, not enforced.
No real employee details or decision about the first employee's login have been
supplied. Creating the first production employee requires its own concrete details
and explicit authorization; release approval alone does not authorize inventing them.

The new service-only RPCs check caller roles, reject existing contact/Auth emails,
reserve a contact, and atomically finish profile, exact role, contact linkage and
optional position. Auth creation remains a separate API operation. The handler
compensates confirmed failures by removing its new Auth user and contact. Unknown
Auth outcomes or failed cleanup return record references and block another submit
in the open form. Do not blindly retry after an uncertain response; inspect the
referenced records. Requests interrupted by a process crash can leave a reserved
contact or new login and need reconciliation; this is not a distributed transaction.

Email duplicate checks serialize requests through this endpoint. They do not
introduce a global unique constraint for legacy/manual contact-edit paths.
The temporary contact stores login email as work_email and contact email as
personal_email, allowing the existing signup trigger to find it. Finalization
clears that temporary work_email and retains contact email (or login email when
contact email is blank) as personal/display email. Auth retains the login email.
A disabled or absent signup trigger is supported; no trigger is enabled by this release.
The legacy convert-existing-contact flow remains paused in independent mode.

## Exact backend changes

1. Apply only `local/candidate-migrations/20261022010000_employee_creation.sql`.
   It adds/replaces these functions, owned by the executing trusted `postgres` role:
   - `public.prepare_employee_creation(uuid,jsonb)`
   - `public.finish_employee_creation(uuid,uuid,uuid,jsonb)`
   - `public.cancel_employee_creation(uuid,uuid)`
   They use a fixed public search path, explicit table schemas and SECURITY DEFINER.
   EXECUTE is revoked from PUBLIC, anon and authenticated; granted only to service_role.
   No table ACLs, existing trigger state, Auth settings, existing records or applied
   migration history are changed. No broad service-role employee table grants are needed.
2. Deploy only `supabase/functions/create-employee/index.ts` and its imported
   `handler.ts` with pinned Supabase CLI 2.121.0 and explicit
   `--project-ref acgqjjbrnkmeazswdnzp`. Keep gateway JWT verification enabled;
   the handler independently checks the Auth user and SQL checks caller roles.
   Use the existing provider-supplied URL/anon/service secrets, never VITE_ keys.
3. Release the reviewed frontend through the existing manual frontend workflow.
   The runtime changes are EmployeeContacts and AddEmployeeWizard. Verification,
   local-only candidate preparation, tests and documentation are not backend deploys.

Do not run `supabase db push`, deploy all functions, copy local/hr-bootstrap.sql,
replay historical migrations, change signup/email providers, or enable other integrations.
This SQL stays in candidate-migrations until separately approved for promotion.
A controlled one-file SQL execution must record its checksum/application receipt;
any later migration promotion must recognize that receipt instead of blindly reapplying.

## Execution after consolidated owner authorization

1. Record the reviewed feature/develop SHA and explicit approval for the release PR
   into main, these exact backend changes and the manual frontend release.
   Follow docs/release-process.md for exact-main checks, candidate hash, plan,
   preflight, upload and retained receipt. No main merge or upload has occurred here.
2. Before backend writes, verify the production project identity and current live
   frontend baseline. Capture the current create-employee function source/version,
   gateway setting, and relevant catalog metadata (function owners/ACLs, table
   columns, enabled trigger bindings) to the private release archive, with checksums.
   Capture no employee rows or credentials in public logs. Confirm the three new
   RPC signatures are absent; if present, stop and compare their exact definitions
   and release receipts rather than overwrite unknown work.
3. Confirm the executing role is postgres and can read auth.users and write the
   four business tables used by the functions. Confirm the existing name/email,
   profile/contact and position trigger definitions match the reviewed baseline,
   including disabled states. Unexpected constraints, ownership or enabled side
   effects require inspection before execution. Existing broad backend backup/restore
   proof remains an outstanding operational item; this feature does not claim it.
4. Apply the one SQL file in its enclosed transaction using the securely supplied
   production connection and ON_ERROR_STOP. Read back all three function definitions,
   owner, SECURITY DEFINER/search_path and ACLs. Confirm anon/authenticated cannot
   execute them and service_role can; no business test rows are needed for this check.
5. Deploy only create-employee from the approved source. Verify the version and
   gateway JWT setting. Before frontend release, verify unauthorized requests are
   denied and an authenticated admin request with an empty name is rejected without
   writes. This bounded hosted check is part of the proposed approval scope, not
   routine synthetic production testing. If gateway authentication fails, stop;
   do not silently disable JWT verification.
6. Release the approved frontend artifact, verify live build identity and directory
   route, and retain source SHA, SQL checksum, function version, frontend artifact
   hash/deployment ID, catalog results and read-only/validation-only check results.
7. When the owner supplies and authorizes the real employee details, create exactly
   that employee once. Check contact-only or requested Auth/profile/role/position
   linkage by IDs. Do not print their password or personal information in logs.
   If uncertain, inspect before retrying. Real login/password delivery acceptance
   is not claimed by local tests.

## Recovery

Before any changes, retain the current frontend deployment/artifact and exact
previous Edge function source/settings. If SQL application fails, its transaction
rolls back. If Edge deployment or frontend release fails, leave onboarding paused
and inspect the observed state before further changes.

After a released feature fails, restore the prior frontend through the existing
manual recovery workflow first so users cannot submit new onboarding requests.
Allow any in-flight creation to settle and reconcile reported contact/user IDs.
Restore the retained prior create-employee function and JWT setting. The three
additive RPCs can remain inert with the UI paused, or after confirming the new
handler is no longer executing, remove exactly:

```sql
BEGIN;
DROP FUNCTION public.finish_employee_creation(uuid,uuid,uuid,jsonb);
DROP FUNCTION public.prepare_employee_creation(uuid,jsonb);
DROP FUNCTION public.cancel_employee_creation(uuid,uuid);
COMMIT;
```

Do not use CASCADE. Do not delete successfully created real employees during
software rollback. For partial creation, inspect Auth metadata
`employee_creation_contact_id`, contact `created_by`/`converted_user_id`, profile
`contact_id`, roles and positions. Delete only explicitly reviewed records from
that failed request, with new authorization for real-data cleanup. Auth deletion
cascades profiles and roles; employee_positions has no Auth foreign key, so its
rows require deliberate cleanup. Preserve audit history and recovery evidence.

## Verification scope

`bun run verify` covers all five groups. The new backend test runs the exact
handler against fixed-loopback Auth/REST, reproduces denied service-role SELECT,
checks signup-trigger enabled/disabled behavior, every role, duplicate emails,
position/pay, invalid inputs, compensation and cleanup failure. It restores trigger
and SELECT state and removes synthetic records. The browser test covers contact
and login creation, persistence, duplicate error details and blocked resubmission
following cleanup failure (the last response is deliberately simulated).

The local Edge runtime remains disabled: browser/API tests adapt the same handler
in Node; Deno entry/import checks run separately. This is not hosted Edge gateway,
SMTP, invitation, Realtime or real-employee acceptance proof.
