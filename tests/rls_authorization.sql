-- YukCep RLS/authorization smoke checks
-- Run manually in Supabase SQL Editor for pre-launch verification.

-- 1) Ensure RLS is enabled on critical tables
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('profiles', 'loads', 'bids', 'notifications', 'runtime_logs', 'abuse_reports')
ORDER BY relname;

-- 2) Ensure key policies exist
SELECT schemaname, tablename, policyname, permissive, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'loads', 'bids', 'notifications', 'runtime_logs', 'abuse_reports')
ORDER BY tablename, policyname;

-- 3) Ensure transition function exists
SELECT proname, prosecdef
FROM pg_proc
WHERE proname IN ('set_load_status_with_transition', 'get_public_stats_fast')
ORDER BY proname;

-- 4) Ensure abuse report table + constraints exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'abuse_reports'
ORDER BY ordinal_position;
