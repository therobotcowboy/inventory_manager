import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    // Warn but don't crash in CI/build steps
    console.warn('Missing Supabase credentials in .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
