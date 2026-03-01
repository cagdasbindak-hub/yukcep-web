# YukCep Web

YukCep is a logistics marketplace web app built with React, Vite, Tailwind v4, and Supabase.

## Runtime Requirements

- Node.js: `^20.19.0 || >=22.12.0`
- npm: latest stable recommended

The project also includes an `.nvmrc` file (`20.19.0`) for predictable local setup.

## Environment Variables

Create `.env` from `.env.example`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

The app fails fast on startup if these variables are missing.

## Scripts

- `npm install` - install dependencies
- `npm run dev` - start development server
- `npm run build` - production build
- `npm run lint` - eslint
- `npm run preview` - preview production build
- `npm run health:check` - HTTP health probe for target URL
- `npm run smoke` - Playwright smoke check
- `npm run a11y:smoke` - accessibility smoke check
- `npm run e2e:live` - full live employer/driver E2E flow

## Database

The canonical schema is in [`schema.sql`](./schema.sql) and includes:

- `profiles`
- `loads`
- `bids`
- `notifications`
- `runtime_logs`
- Row-Level Security (RLS) policies matching frontend behavior

Apply the schema in your Supabase SQL editor before using authenticated flows.

## Launch Ops

- CI workflows: `.github/workflows/`
- Rollback runbook: [`docs/ROLLBACK_RUNBOOK.md`](./docs/ROLLBACK_RUNBOOK.md)
- Security checklist: [`docs/SECURITY_CHECKLIST.md`](./docs/SECURITY_CHECKLIST.md)
- Error tracking: [`docs/ERROR_TRACKING.md`](./docs/ERROR_TRACKING.md)
- Analytics plan: [`docs/ANALYTICS_PLAN.md`](./docs/ANALYTICS_PLAN.md)
- Funnel query model: [`sql/funnel_dashboard.sql`](./sql/funnel_dashboard.sql)
- SLO/KPI targets: [`docs/LAUNCH_SLO_KPI.md`](./docs/LAUNCH_SLO_KPI.md)

## Notes

- Keep `.env` out of version control.
- Use `.env.example` as the only committed env template.
