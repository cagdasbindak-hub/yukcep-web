# YukCep Analytics Event Plan

## Event Naming Convention
- `AREA_ACTION_RESULT`
- Examples: `AUTH_LOGIN_SUCCESS`, `POST_LOAD_SUCCESS`, `BID_SUBMIT_FAILED`

## Core Events
1. `APP_WELCOME_VIEW`
2. `AUTH_SIGNUP_SUCCESS`
3. `AUTH_LOGIN_SUCCESS`
4. `ROLE_SWITCH_OK`
5. `LOADS_FETCH_OK`
6. `LOAD_DETAIL_OPEN`
7. `POST_LOAD_SUCCESS`
8. `POST_LOAD_FAILED`
9. `BID_SUBMIT_OK`
10. `BID_SUBMIT_FAIL`
11. `BID_DECISION_OK`
12. `BID_DECISION_FAIL`
13. `ABUSE_REPORT_CREATED`

## Required Properties
- `user_id` (nullable)
- `role` (`driver|employer|unknown`)
- `screen`
- `app_version`
- `session_id`
- `event_time_utc`

## Storage Strategy
- Phase 1: Runtime logs table (`runtime_logs`) with event code + details.
- Phase 2: Dedicated analytics sink (warehouse/BI) via ETL.

## Dashboards
- Conversion: signup -> role selected -> first successful action.
- Marketplace: load posted -> bid received -> bid accepted.
- Reliability: timeout/error events by endpoint and app version.

## Alert Thresholds
- `POST_LOAD_FAILED` rate > 5% in 15 min.
- `BID_SUBMIT_FAIL` rate > 3% in 15 min.
- `LOADS_FETCH_FAIL` rate > 2% in 15 min.
