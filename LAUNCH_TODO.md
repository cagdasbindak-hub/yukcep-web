# YukCep Launch Checklist (1-28)

Date: 2026-03-01

Legend:
- `DONE`: implemented + validated
- `BLOCKED`: cannot complete without external production access/credentials
- `WIP`: in progress

1. `DONE` Timeout reduction + fallback hardening (`src/lib/api.js`, `schema.sql` fast stats RPC, capped load queries).
2. `DONE` DB index hardening (`schema.sql` critical indexes for loads/bids/abuse_reports).
3. `BLOCKED` RLS/authorization suite created (`tests/rls_authorization.sql`) but production execution requires privileged Supabase SQL access.
4. `DONE` Legacy role migration added (`schema.sql` role cleanup update).
5. `DONE` Load state machine with guarded transitions (`schema.sql` `set_load_status_with_transition` + API integration).
6. `DONE` Persistent critical error panel active (`src/App.jsx`).
7. `DONE` Centralized runtime error tracking + release tag (`src/App.jsx` `app_version`, `docs/ERROR_TRACKING.md`).
8. `DONE` Health checks and scheduled workflow (`scripts/health-check.mjs`, `.github/workflows/health-check.yml`).
9. `DONE` Backup/rollback runbook (`docs/ROLLBACK_RUNBOOK.md`).
10. `DONE` Security guardrails + secret scan (`docs/SECURITY_CHECKLIST.md`, `.github/workflows/security.yml`, removed hardcoded Supabase fallback key).
11. `DONE` Role-based entry flow polish (welcome CTAs + role-specific feed navigation in `src/App.jsx`).
12. `DONE` Persisted settings panel (notifications/language/privacy/security toggles in `src/App.jsx`).
13. `DONE` `Benim Yapacak İşlerim` tabbed feed (active/planned/completed in `src/App.jsx`).
14. `DONE` Employer teklif board/kanban quick view (`src/App.jsx` `employerBidBoard` section).
15. `DONE` Load card ETA + distance + trailer visibility (`src/App.jsx` load cards).
16. `DONE` Empty-state UX copy improved (driver/employer/list empty states).
17. `DONE` Popup z-index and body overflow lock (`src/App.jsx` overlay effect).
18. `DONE` Bundle optimization (lazy components + manual chunks in `vite.config.js`).
19. `DONE` CI pipeline for lint/build/smoke/a11y (`.github/workflows/ci.yml`).
20. `DONE` Post-deploy smoke automation (`.github/workflows/post-deploy-smoke.yml` + smoke scripts).
21. `DONE` Accessibility smoke checks (`scripts/a11y-smoke.mjs` + CI step).
22. `DONE` Analytics plan + event points (`docs/ANALYTICS_PLAN.md`, runtime event instrumentation).
23. `DONE` Funnel model definition (`sql/funnel_dashboard.sql`).
24. `DONE` Legal content screens + policy doc (`src/App.jsx`, `docs/LEGAL_POLICIES.md`).
25. `DONE` Support flow screens + playbook (`src/App.jsx`, `docs/SUPPORT_FLOW.md`).
26. `DONE` Moderation/reporting with anti-spam cooldown (`schema.sql`, `src/lib/api.js`, `src/App.jsx`).
27. `DONE` Email + phone gating policy toggles and checks (`src/App.jsx` settings + action guards).
28. `DONE` Launch SLO/KPI targets (`docs/LAUNCH_SLO_KPI.md`).

## Blocked Items To Retry At End

- `#3` Execute `tests/rls_authorization.sql` in Supabase SQL editor with privileged project credentials and archive output.
- `feedback` RESOLVED (2026-03-02): `public.feedback_items` is available in production and feedback board read/write works with no schema-cache errors.
