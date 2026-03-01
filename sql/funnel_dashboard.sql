-- YukCep Funnel Model (daily)
-- Uses runtime_logs event_code and core domain tables.

WITH day_window AS (
  SELECT date_trunc('day', now() AT TIME ZONE 'utc')::date AS d
),
signed_up AS (
  SELECT COUNT(DISTINCT p.id) AS users
  FROM public.profiles p
  JOIN day_window w ON p.created_at::date = w.d
),
role_selected AS (
  SELECT COUNT(DISTINCT p.id) AS users
  FROM public.profiles p
  JOIN day_window w ON p.created_at::date = w.d
  WHERE p.role IN ('driver', 'employer')
),
first_load_post AS (
  SELECT COUNT(DISTINCT l.employer_id) AS users
  FROM public.loads l
  JOIN day_window w ON l.created_at::date = w.d
),
first_bid AS (
  SELECT COUNT(DISTINCT b.driver_id) AS users
  FROM public.bids b
  JOIN day_window w ON b.created_at::date = w.d
),
accepted_bid AS (
  SELECT COUNT(DISTINCT b.driver_id) AS users
  FROM public.bids b
  JOIN day_window w ON b.updated_at::date = w.d
  WHERE b.status = 'ACCEPTED'
)
SELECT
  w.d AS day_utc,
  s.users AS signup_users,
  r.users AS role_selected_users,
  l.users AS employers_posted_load,
  b.users AS drivers_placed_bid,
  a.users AS drivers_with_accepted_bid
FROM day_window w
CROSS JOIN signed_up s
CROSS JOIN role_selected r
CROSS JOIN first_load_post l
CROSS JOIN first_bid b
CROSS JOIN accepted_bid a;
