# Security & Data Protection Policy

This document describes how this application protects employee compensation, benefits, and personally identifiable information (PII), and how we comply with the **New York SHIELD Act** (NY Gen. Bus. Law § 899-bb) and standard payroll data security practices.

## 1. Data Classification

| Class | Examples | Where stored |
|-------|----------|--------------|
| **Highly Sensitive (Private Info)** | Pay rates, salaries, bonuses, benefits values, comp history | `employee_positions`, `employee_benefits`, `employee_compensation_history` |
| **Sensitive** | Pay band ranges, position assignments | `positions`, `employee_positions` |
| **Internal** | Employee name, email, role | `profiles`, `user_roles` |
| **Operational** | Jobs, schedules, dispatch | `jobs`, `schedule_assignments`, `dispatch_orders` |

NY SHIELD Act defines "private information" to include financial account numbers and **biometric/employment-related identifiers when combined with name** — wage and salary data falls under this protection.

## 2. Administrative Safeguards

- **Designated administrator**: Users with the `admin` role are the only personnel authorized to view or modify pay/benefit/comp data.
- **Least privilege**: All other roles (`employee`, `foreman`, `office`) cannot access any other employee's compensation.
- **Access review**: The `pay_audit_log` should be reviewed at least quarterly by an admin to detect anomalous access.
- **Training**: Admins must understand that all pay-data actions are logged and attributable.

## 3. Technical Safeguards

### Row-Level Security (RLS)
Every table containing private information has RLS enabled with strict policies:
- `employee_positions`, `employee_benefits`, `employee_compensation_history`: employees can SELECT only their own row; only admins can INSERT/UPDATE/DELETE.
- `positions`: pay bands (`min_pay_rate`, `max_pay_rate`) are visible only to admins, or to the specific employee currently assigned to that position. A `positions_public` view (no pay bands) serves all other reads.
- `pay_audit_log`: SELECT admin-only; no INSERT/UPDATE/DELETE policies — only SECURITY DEFINER triggers can write.

### Audit Logging
Every INSERT / UPDATE / DELETE on `employee_positions`, `employee_benefits`, and `employee_compensation_history` is recorded in `pay_audit_log` with:
- Acting user ID and email
- Action type
- Old and new values (full row, JSONB)
- Timestamp
The log is append-only and admin-readable.

### Validation
Database-level triggers enforce:
- No negative pay rates, salaries, bonuses, or benefit values
- `end_date >= effective_date` on time-bounded records
- Reasonable year ranges on compensation history
- `total_compensation` is computed server-side, not trusted from the client

### Authentication
- Email + password (Supabase Auth)
- Email confirmation required before sign-in
- **HIBP (Have I Been Pwned) leaked-password check enabled** — passwords found in known breaches are rejected
- Sessions are JWT-based with automatic refresh
- **Admins should enable MFA** in their account settings (Supabase dashboard → Authentication)

### Function Hardening
All database functions use `SET search_path = public` to prevent search-path hijacking attacks.

### Secrets
API keys and service credentials are stored as Supabase Edge function secrets and GitHub Actions secrets, never in source code.

## 4. Physical & Network Safeguards
- Hosted on Supabase (SOC 2 Type II certified) on AWS infrastructure
- All traffic over TLS 1.2+
- Database encrypted at rest

## 5. Breach Response (NY SHIELD Requirement)

In the event of unauthorized access to private information:
1. **Immediate**: Revoke compromised credentials, rotate API keys and Edge function secrets in the Supabase dashboard (production project `acgqjjbrnkmeazswdnzp`).
2. **Within 24 hours**: Review `pay_audit_log` to determine scope.
3. **"Most expedient time possible, without unreasonable delay"** (NY § 899-aa): Notify affected NY residents.
4. Notify NY Attorney General, Department of State, and Division of State Police if more than 500 NY residents affected.
5. Consumer reporting agencies if more than 5,000 affected.

## 6. Data Retention

- **Payroll-related records**: retained at least **6 years** (NY Labor Law § 195.4 requirement).
- **Audit log**: retained indefinitely; do not delete `pay_audit_log` rows.
- **Departed employees**: profile marked `is_active = false`; pay records retained per the 6-year rule.

## 7. Operational Checklist

- [ ] At least one admin has MFA enabled
- [ ] HIBP password check is enabled (✅ enabled)
- [ ] Quarterly review of `pay_audit_log`
- [ ] Annual review of all RLS policies
- [ ] Annual review of admin role assignments in `user_roles`

## 8. Contact

Report security issues to the designated company administrator immediately. Do not disclose vulnerabilities publicly.

---

_Last updated: 2026-04-21_
