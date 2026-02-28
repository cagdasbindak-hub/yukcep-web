import { createClient } from '@supabase/supabase-js';

const fallbackSupabaseUrl = 'https://uojbatkufexxwdosomxk.supabase.co';
const fallbackSupabaseAnonKey = 'sb_publishable_tsdP4zYiDsBaL8ihojZ6Zg_hiHEGX60';
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
        'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
