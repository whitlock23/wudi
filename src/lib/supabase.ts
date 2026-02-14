import { createClient } from '@supabase/supabase-js';
import { mockSupabase } from './mockSupabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const useMock = import.meta.env.VITE_USE_MOCK === 'true';

if (!useMock && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn('Missing Supabase URL or Anon Key. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

// Fallback to a placeholder URL to prevent "Invalid URL" crash during initialization
// if the environment variables are missing.
const url = supabaseUrl || 'https://placeholder.supabase.co';
const key = supabaseAnonKey || 'placeholder';

export const supabase = useMock ? mockSupabase : createClient(
  url,
  key
);
