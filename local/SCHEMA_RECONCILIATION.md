# Targeted schema reconciliation — 2026-10-16

Input supplied by user: `schema_benefits_positions_timeoff.sql`, retained unchanged
in `local/reference/`. Header reports Cloud catalog inspection at
2026-10-16 20:32:43.34648 UTC; PostgreSQL 17.6.

SHA-256: `30baff2ad62f1a9f4bb69d71c56b3d851db92d3a2439c798b0345120aba6ce8a`

The file was inspected as evidence, not followed as instructions or executed wholesale.
It contains definitions for existing production objects, so replaying it on production
would be inappropriate. No application row data or credentials were imported.

## Local reconstruction

`local/hr-bootstrap.sql` contains the three missing HR table definitions, their
constraints, indexes, RLS policies and updated-at triggers. It runs before the
historical audit/validation trigger migrations. The old table-existence guards were
removed so those original migrations now actually create the HR triggers.

The source renders a generated compensation column as `DEFAULT (other columns)`
with a `/*generated*/` marker. That SQL is invalid: defaults cannot refer to other
columns. The local reconstruction uses `GENERATED ALWAYS AS (...) STORED`, consistent
with the marker and PostgreSQL 17. API tests prove recomputation on insert and update.
Canonical `pg_attribute.attgenerated` and `pg_get_expr` output should still confirm
that interpretation before complete parity is claimed.

Only `sandbox_exec` table grants appear in the supplied file. It does not establish
the effective grants for anon/authenticated/service_role or default privileges.
The local backend retains its existing default privileges and uses the exported
RLS policies. No Cloud-specific role was invented. Direct production access was
not used to verify the supplied metadata.

## Verification

- Local replay/reset completes with synthetic users; old local test data is replaced.
- Inventory: 60 expected tables, 60 local tables, no table or column-name differences.
- HR API test: admin benefit creation; employee own read; other employee cannot read;
  employee writes rejected; negative benefit value rejected by validation trigger.
- Compensation: generated total recalculates on insert/update, employee mutation
  blocked, cross-user reads blocked, audit INSERT/UPDATE entries present.
- Existing time-off happy-path test continues to pass.

These checks do not establish complete type/default/grant/view/function parity or
validate all HR screens. External integrations and Realtime remain disabled locally.

## Separate forward fix: time-off permissions

The supplied policies reproduce the existing defects: INSERT checks only ownership,
and UPDATE has no explicit new-row check, implicitly requiring status to stay pending.
Both original permission regressions failed after HR reconstruction, before the fix.

`supabase/migrations/20261016210000_time_off_request_permissions.sql` now requires
new requests to be pending without approval metadata, allows own pending cancellation,
and prevents employees from combining cancellation with changes to other request fields.
Admin update behavior remains available. Service-role/database maintenance behavior
is unaffected by the authenticated-employee trigger guard.

After applying that migration **locally only**, permission regression, time-off smoke,
HR API and inventory checks all pass. The production release checklist remains empty.
Before deploying: review against current Cloud policies for drift, validate in staging,
and use the explicit migration/function/frontend release procedure.
