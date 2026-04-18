import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@/lib/supabase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Skip auth initialization if supabase is not available (placeholder mode)
    if (!supabase) {
      setLoading(false);
      return;
    }

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
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUser(data as User);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signUp = useCallback(async (email: string, password: string, name: string, referralCode?: string) => {
    if (!supabase) {
      // Mock signup for development
      console.log('Mock signup:', { email, name, referralCode });
      return { data: { user: { id: 'mock-user-id', email, user_metadata: { name } } }, error: null };
    }

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
          .single() as any;

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
    if (!supabase) {
      // Mock signin for development
      console.log('Mock signin:', { email });
      return { data: { user: { id: 'mock-user-id', email } }, error: null };
    }

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
    if (!supabase) {
      // Mock signout for development
      setUser(null);
      setSession(null);
      return { error: null };
    }

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
    if (!supabase) {
      // Mock profile update for development
      console.log('Mock profile update:', updates);
      return { data: { ...user, ...updates } as User, error: null };
    }

    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single() as any;

      if (error) throw error;
      setUser(data as User);
      return { data: data as User, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }, [user]);

  const refreshUser = useCallback(async () => {
    if (!supabase) {
      // Mock refresh for development
      return;
    }

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
