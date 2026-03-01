# YukCep Security Cleanup Checklist

## Secrets and Credentials
- [ ] No hardcoded API keys/tokens in source.
- [ ] `.env` is gitignored and only `.env.example` is committed.
- [ ] Supabase anon key is loaded only from environment variables.
- [ ] Tokens and personal data are sanitized before runtime log persistence.

## Access Control
- [ ] RLS enabled for all user-facing tables (`profiles`, `loads`, `bids`, `notifications`, `runtime_logs`, `abuse_reports`).
- [ ] Role transitions restricted to authenticated owner flows.
- [ ] Load status transitions validated by DB function.
- [ ] Abuse report table only readable by reporter/admin path.

## Supply Chain and CI
- [ ] `npm audit --audit-level=high` in CI.
- [ ] Secret scanning (Gitleaks) on PR and main branch.
- [ ] CI fails on lint/build/smoke test errors.

## Runtime and Incident Safety
- [ ] Critical failures visible in persistent error panel (not auto-dismissed).
- [ ] Client logs redacted for email/phone/token patterns.
- [ ] Incident runbook exists (`docs/ROLLBACK_RUNBOOK.md`).

## Manual Pre-Launch Security Gate
1. Create temporary test users (employer + driver).
2. Verify cross-user data access is denied by RLS.
3. Verify role switch flow cannot mutate another user.
4. Verify report spam throttle works (same user/load cooldown).
5. Confirm no token/email leakage in UI logs.
