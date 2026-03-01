# YukCep Backup and Rollback Runbook

## Scope
- Vercel deployment rollback
- Supabase schema/data rollback
- Emergency feature-flag fallback

## Preconditions
- Last successful git commit SHA is known.
- `schema.sql` and migration SQL is versioned in repo.
- Supabase project backup/export is available before structural DB changes.

## Standard Backup Steps (Before Release)
1. Tag release candidate: `git tag release-YYYYMMDD-HHMM`.
2. Export production schema from Supabase SQL editor.
3. Export critical tables snapshot (`loads`, `bids`, `notifications`, `profiles`) to secure storage.
4. Run `npm run build` and `npm run smoke` on preview URL.
5. Record results in release notes with commit SHA and deployment URL.

## Application Rollback (Vercel)
1. Open Vercel project deployments.
2. Promote previous stable deployment to production.
3. Verify with:
   - `npm run health:check` (`YUKCEP_BASE_URL` = prod)
   - `npm run smoke`
4. Monitor runtime logs for 15 minutes (`POST_LOAD_FAILED`, `LOADS_FETCH_FAIL`, `BID_SUBMIT_FAIL`).

## Database Rollback
1. Stop write-heavy operations if possible (maintenance banner).
2. Revert incompatible SQL changes using inverse migration SQL.
3. Restore table snapshots if data corruption exists.
4. Re-apply only stable schema subset.
5. Re-run smoke flows:
   - employer load create
   - driver bid create
   - employer accept/reject bid

## Incident Severity and Decision
- `SEV-1`: login/post/bid broken for majority of users -> immediate rollback.
- `SEV-2`: partial feature degradation with fallback available -> hotfix first, rollback if >30 min unresolved.
- `SEV-3`: cosmetic/non-blocking -> no rollback, patch next release.

## Post-Rollback Actions
1. Open incident note with exact UTC timestamps.
2. Attach failing/healthy artifacts (`tmp/health`, `tmp/smoke`, runtime logs).
3. Create follow-up tasks for root cause and regression tests.
