import { createClient } from '@supabase/supabase-js';
import { mockSupabase } from './mockSupabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// Automatically use mock if explicitly set OR if credentials are missing
const useMock = import.meta.env.VITE_USE_MOCK === 'true' || !supabaseUrl || !supabaseAnonKey;

if (!useMock && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn('Missing Supabase URL or Anon Key. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

// Fallback to a placeholder URL to prevent "Invalid URL" crash during initialization
// if the environment variables are missing.
const url = supabaseUrl || 'https://placeholder.supabase.co';
const key = supabaseAnonKey || 'placeholder';

export const isMock = useMock;

export const supabase = useMock ? mockSupabase : createClient(
  url,
  key
);
