
# Roles + Clearstory + HCSS Maintenance

Three related additions to the Schreiber app.

## 1. Per-person access levels (roles)

Standard secure pattern — roles in their own table, never on `profiles`.

**Roles**
- `employee` — schedule, weather, plans (read), receipts, vacation requests
- `foreman` — everything employee has + Clearstory + (optionally) approve their crew's vacation
- `office` — Bill.com receipt review, schedule posting
- `admin` — manage users, assign roles, change settings

**How it works**
- `user_roles` table (`user_id`, `role`) — separate from profiles
- `has_role()` security-definer function used in all RLS policies (avoids recursion)
- **Admin → Users page**: list every employee, change their role from a dropdown, deactivate accounts
- Each app tile (Schedule, Plans, Clearstory, Maintenance, Vacation, Receipts) only renders if the user's role allows it
- Server-side checks in every edge function — never trust the client

## 2. Clearstory (foreman-only)

Clearstory has no Lovable connector and their public API is limited to enterprise accounts. Practical approach:

**Smart launcher tile** visible only to `foreman` and `admin` roles
- Big "Open Clearstory" button → opens `app.clearstory.build` (or your tenant URL) in a new tab / native app if installed
- Single sign-on if your Clearstory account uses SSO; otherwise the foreman logs in once and the browser remembers
- Optional: a short "What is this for?" helper line for new foremen

If you later get Clearstory API access, we can layer in pulling recent CORs/RFIs directly into the app — but the launcher gives value today with zero integration work.

## 3. HCSS Equipment Maintenance launcher

Same pattern — `mr.hcssapps.com` is HCSS Equipment360 web app. No public connector.

**Maintenance tile** visible to `employee`, `foreman`, `admin`
- Button opens `https://mr.hcssapps.com` in a new tab
- HCSS handles its own login (employees use their HCSS credentials)
- Optional: short instructions ("Log issue → select unit → describe problem → submit")

## Updated app home screen
```text
┌──────────────────────────────┐
│  Schreiber Excavating        │
│  Hi, Mike (Foreman)          │
├──────────────────────────────┤
│  ☀ 64° Partly Cloudy         │
├──────────────────────────────┤
│  📅 Schedule                 │
│  📐 Project Plans            │
│  🔧 Equipment Maintenance    │
│  📋 Clearstory   (foreman)   │
│  🧾 Submit Receipt           │
│  🏖  Request Time Off         │
│  ⚙  Admin       (admin only) │
└──────────────────────────────┘
```

Tiles auto-hide based on role.

## Quick questions
1. **Role list** — does `employee / foreman / office / admin` cover it, or do you want more (e.g. `mechanic`, `estimator`)?
2. **Who assigns roles** — only `admin`, or should `office` also be able to?
3. **Default role** — when a new user signs up, should they start as `employee` (admin promotes later) or stay role-less until approved?
4. **Clearstory URL** — is it the standard `app.clearstory.build` login, or do you have a custom tenant URL?

Reply with answers (or "go with defaults": four roles above, admin-only assigns, new signups default to `employee`, standard Clearstory URL) and this slots into the build alongside the other features.
