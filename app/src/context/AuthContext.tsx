import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: any | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isVendor: boolean;
  signUp: (email: string, password: string, name: string, referralCode?: string) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<any>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getApiBaseUrl = (): string => {
  const base = import.meta.env.VITE_API_URL || '';
  if (!base) return 'http://localhost:3001';
  return String(base).replace(/\/+$/, '');
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfileFromBackend = async (accessToken: string): Promise<void> => {
    const res = await fetch(`${getApiBaseUrl()}/api/auth/me`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const json: any = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.error || `Failed to load profile (${res.status})`);
    }

    // Backend returns: { success: true, data: appUser }
    setUser(json?.data as User);
  };

  // Initialize auth on component mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: getSessionData } = await supabase.auth.getSession();
        const session = getSessionData?.session ?? null;

        setSession(session);

        if (session?.user) {
          const accessToken = (session as any).access_token as string | undefined;
          if (!accessToken) throw new Error('Missing access token');

          await fetchUserProfileFromBackend(accessToken);
          return;
        }

        setLoading(false);
      } catch (error) {
        console.error('Error initializing auth:', error);
        setUser(null);
        setSession(null);
        setLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        setSession(nextSession);

        if (nextSession?.user) {
          const accessToken = (nextSession as any).access_token as string | undefined;
          if (!accessToken) {
            setUser(null);
            setLoading(false);
            return;
          }

          try {
            setLoading(true);
            await fetchUserProfileFromBackend(accessToken);
          } catch (e) {
            console.error('Error fetching profile after auth change:', e);
            setUser(null);
          } finally {
            setLoading(false);
          }

          return;
        }

        setUser(null);
        setLoading(false);
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name: string, referralCode?: string) => {
    try {
      setLoading(true);

      // Keep Supabase auth for sign-up (current backend proxies sign-up too, but this keeps UX working).
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

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
            .eq('id', data.user.id);
        }
      }

      return { data, error: null };
    } catch (error: any) {
      console.error('Sign up error:', error);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      console.error('Sign in error:', error);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!session?.user) return { error: new Error('Not authenticated') };

    try {
      const accessToken = (session as any)?.access_token as string | undefined;
      if (!accessToken) throw new Error('Missing access token');

      const res = await fetch(`${getApiBaseUrl()}/api/users/me`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const json: any = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Failed to update profile (${res.status})`);

      setUser(json?.data as User);
      return { data: json?.data as User, error: null };
    } catch (error: any) {
      console.error('Update profile error:', error);
      return { data: null, error };
    }
  };

  const refreshUser = async () => {
    try {
      const accessToken = (session as any)?.access_token as string | undefined;
      if (!accessToken) return;
      await fetchUserProfileFromBackend(accessToken);
    } catch (e) {
      console.error('refreshUser error:', e);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    isAuthenticated: !!session,
    isAdmin: user?.role === 'admin',
    isVendor: user?.role === 'vendor',
    signUp,
    signIn,
    signOut,
    updateProfile,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
