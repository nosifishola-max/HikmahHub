import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@/lib/supabase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      // Handle null data gracefully (e.g., fresh signup before user row created)
      setUser(data as User | null);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signUp = useCallback(async (email: string, password: string, name: string, referralCode?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });

      if (error) throw error;

      // Handle referral if provided
      if (referralCode && data.user) {
        const { data: referrer } = await supabase
          .from('users')
          .select('id')
          .eq('referral_code', referralCode)
          .maybeSingle() as any;

        if (referrer) {
          await supabase
            .from('users')
            .update({ referred_by: (referrer as any).id })
            .eq('id', data.user.id) as any;
        }
      }

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select()
        .maybeSingle() as any;

      if (error) throw error;
      setUser(data as User);
      return { data: data as User, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }, [user]);

  const refreshUser = useCallback(async () => {
    if (session?.user) {
      await fetchUserProfile(session.user.id);
    }
  }, [session]);

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    refreshUser,
    isAuthenticated: !!session,
    isAdmin: user?.role === 'admin',
    isVendor: user?.role === 'vendor',
  };
}
