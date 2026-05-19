import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, Profile, Subscription } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  subscription: Subscription | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isPremium: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchSubscription(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          await fetchProfile(currentUser.id);
          await fetchSubscription(currentUser.id);
        } else {
          setProfile(null);
          setSubscription(null);
        }
        setLoading(false);
      }
    );

    return () => {
      authListener.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (!error && data) {
      setProfile(data);
    }
  };

  const fetchSubscription = async (userId: string) => {
    // In production, this would be fetched from the subscriptions table
    // which is updated by RevenueCat/Stripe webhooks.
    const { data, error } = await supabase
      .from('subscriptions')
      .select('status, plan_id, entitlement, current_period_end')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setSubscription(data as Subscription);
    } else {
      // Check local mock status for dev/test purposes if specifically enabled
      const mockPremium = localStorage.getItem('verso_test_premium') === 'true';
      if (mockPremium) {
        setSubscription({
          status: 'active',
          plan_id: 'verso_test_plan',
          entitlement: 'premium'
        });
      } else {
        setSubscription(null);
      }
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isPremium = subscription?.status === 'active' || subscription?.status === 'trialing';

  return (
    <AuthContext.Provider value={{ user, profile, subscription, loading, signOut, isPremium }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
