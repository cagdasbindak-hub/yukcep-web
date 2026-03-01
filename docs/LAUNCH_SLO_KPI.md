# YukCep Launch SLO / KPI Targets

## Reliability SLOs (First 30 Days)
- Homepage availability: `>= 99.5%`
- Public load list success: `>= 99.0%`
- Load post success (authenticated employer): `>= 97.0%`
- Bid submit success (authenticated driver): `>= 97.0%`
- P95 API response target: `< 1500 ms` for list endpoints

## Error Budget
- Monthly availability budget: `0.5%`
- Action failure budget (post/bid): `3.0%`

## Product KPIs
- New signup completion rate: `>= 60%`
- Employer first load post within 24h: `>= 40%`
- Driver first bid within 24h: `>= 35%`
- Bid acceptance rate: `>= 20%`

## Operational KPIs
- Mean time to detect (MTTD): `< 10 min`
- Mean time to recover (MTTR): `< 45 min`
- Post-deploy smoke pass rate: `100%` required to keep deployment

## Weekly Review Pack
1. SLO burn chart (availability + action failure).
2. Funnel chart (signup -> role -> first key action).
3. Top 10 runtime error codes by count and impacted users.
