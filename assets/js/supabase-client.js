import { createClient } from '@supabase/supabase-js';

const isPlaceholder = function (value) {
  return !value || typeof value !== 'string' || value.includes('SUA_') || value.includes('YOUR_') || value.includes('EXAMPLE');
};

const supabaseUrl = window.SUPABASE_URL;
const supabaseAnonKey = window.SUPABASE_ANON_KEY;

if (isPlaceholder(supabaseUrl) || isPlaceholder(supabaseAnonKey)) {
  console.error('Supabase não configurado. Defina window.SUPABASE_URL e window.SUPABASE_ANON_KEY com valores válidos.');
} else {
  window.supabase = { createClient: createClient };
  if (!window.supabaseClient || typeof window.supabaseClient.from !== 'function') {
    window.supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
}
