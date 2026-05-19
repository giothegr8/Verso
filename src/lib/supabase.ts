import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Auth and data persistence will be disabled.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

export type Profile = {
  id: string;
  email: string;
  display_name?: string;
  preferred_language?: string;
  memorization_language?: string;
  onboarding_completed: boolean;
};

export type Subscription = {
  status: 'active' | 'trialing' | 'canceled' | 'inactive';
  plan_id?: string;
  entitlement?: string;
  current_period_end?: string;
};
