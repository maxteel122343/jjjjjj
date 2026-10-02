import { createClient } from '@supabase/supabase-js';

const sanitize = (val: unknown, fallback: string): string => {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim().replace(/^["']|["']$/g, '');
  return trimmed || fallback;
};

const DEFAULT_URL = 'https://hvmhbwhshzbmkgwdznji.supabase.co';
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2bWhid2hzaHpibWtnd2R6bmppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1ODk4NTAsImV4cCI6MjEwNTE2NTg1MH0.4crdwa5GfTM441gyIIZPydm9B2Y-YzAS-g2Q18C1yrI';

const rawUrl = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : undefined;
const rawKey = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;

export const SUPABASE_URL = sanitize(rawUrl, DEFAULT_URL);

let candidateKey = sanitize(rawKey, DEFAULT_ANON_KEY);
// Validate candidate key format: Supabase anon keys are 3-segment JWTs
if (!candidateKey || candidateKey.split('.').length !== 3) {
  candidateKey = DEFAULT_ANON_KEY;
}

export const SUPABASE_ANON_KEY = candidateKey;

export const activeSupabaseRef = SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0] || 'supabase';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

