import { createClient } from '@supabase/supabase-js';

const fallbackSupabaseUrl = 'https://uojbatkufexxwdosomxk.supabase.co';
const fallbackSupabaseAnonKey = 'sb_publishable_tsdP4zYiDsBaL8ihojZ6Zg_hiHEGX60';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
