

## Fix: pay validation trigger crash on `employee_compensation_history`

### The bug
The shared `validate_pay_record()` trigger references `NEW.annual_value`, `NEW.end_date`, and `NEW.effective_date` — but `employee_compensation_history` has none of those fields. PL/pgSQL resolves `NEW.<field>` against the actual triggering row type at runtime, so the moment you insert a comp-history row the trigger throws `record "new" has no field "annual_value"`.

The session replay confirms this fired when saving a comp-history record with notes "Current rate as of December 2025."

### Plan

1. **Migration — split validation into per-table functions** so each only references fields that exist on its own table:
   - `validate_employee_position()` — checks `pay_rate >= 0` and `end_date >= effective_date`
   - `validate_employee_benefit()` — checks `annual_value >= 0` and `end_date >= effective_date`
   - Keep existing `validate_comp_history()` as-is (already correct, has its own function)
2. **Drop** the existing combined `validate_pay_record` triggers from `employee_positions` and `employee_benefits` (and from `employee_compensation_history` if it was attached there by mistake).
3. **Re-attach** the new per-table validation triggers to the correct tables.
4. **Drop** the now-unused `validate_pay_record()` function.
5. No frontend changes needed — the existing `AdminPositions.tsx` flow and any comp-history insert UI will start working immediately.

### Verification after applying
- Insert an `employee_compensation_history` row → succeeds, `total_compensation` auto-computed.
- Try negative `pay_rate` on `employee_positions` → blocked.
- Try negative `annual_value` on `employee_benefits` → blocked.
- Try `end_date < effective_date` on either table → blocked.

