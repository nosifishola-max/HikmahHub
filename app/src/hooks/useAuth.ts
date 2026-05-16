import { useAuthContext } from '@/context/AuthContext';
import type { User } from '@/lib/supabase';

export function useAuth() {
  const ctx = useAuthContext();

  return {
    user: ctx.user,
    session: ctx.session,
    loading: ctx.loading,
    isAuthenticated: ctx.isAuthenticated,
    isAdmin: ctx.isAdmin,
    isVendor: ctx.isVendor,

    signUp: ctx.signUp,
    signIn: ctx.signIn,
    signOut: ctx.signOut,
    updateProfile: ctx.updateProfile,
    refreshUser: ctx.refreshUser,
  };
}
