# YukCep Error Tracking Model

## Objective
Provide centralized client-side event/error observability with release tagging.

## Current Implementation
- All runtime events are captured via `appendRuntimeLog(...)` in `App.jsx`.
- Logs are buffered locally and flushed to `runtime_logs` table.
- Sensitive patterns are redacted before remote insert (email/phone/token).
- Every record carries `app_version` (`VITE_APP_VERSION` fallback: `2026.03.01`).

## Critical Event Codes
- `POST_LOAD_FAILED`
- `BID_SUBMIT_FAIL`
- `BID_DECISION_FAIL`
- `LOADS_FETCH_FAIL`
- `PUBLIC_STATS_REST_FAIL`

## Release Correlation
- Set `VITE_APP_VERSION` at build/deploy.
- Use `app_version` to compare error rates across releases.
- Rollback trigger: if critical failure rate breaches SLO thresholds.
