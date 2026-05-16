import { useState, useCallback } from 'react';
import { supabase, PRICING } from '@/lib/supabase';
import type { Vendor, User } from '@/lib/supabase';

export interface VendorWithUser extends Vendor {
  user?: User;
}

function getApiBaseUrl(): string | null {
  const base = import.meta.env.VITE_API_URL as string | undefined;
  if (!base) return null;
  return String(base).replace(/\/+$/, '');
}

export function useVendors() {
  const [vendors, setVendors] = useState<VendorWithUser[]>([]);
  const [loading, setLoading] = useState(false);

  const getVendors = useCallback(async (filters?: {
    featured?: boolean;
    category?: string;
    verified?: boolean;
  }) => {
    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl) {
      return { data: [], error: 'Missing VITE_API_URL' };
    }

    setLoading(true);
    try {
      const url = new URL('/api/vendors', apiBaseUrl);
      if (filters?.featured !== undefined) url.searchParams.set('featured', String(filters.featured));
      if (filters?.category) url.searchParams.set('category', filters.category);
      if (filters?.verified !== undefined) url.searchParams.set('verified', String(filters.verified));

      const res = await fetch(url.toString());
      const json: any = await res.json().catch(() => null);

      if (!res.ok) {
        return { data: [], error: json?.error || `Failed to fetch vendors (${res.status})` };
      }

      const data = (json?.data ?? []) as VendorWithUser[];
      setVendors(data);
      return { data, error: null as string | null };
    } catch (e: any) {
      return { data: [], error: e?.message || 'Failed to fetch vendors' };
    } finally {
      setLoading(false);
    }
  }, []);

  const getVendor = useCallback(async (id: string) => {
    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl) return { data: null as VendorWithUser | null, error: 'Missing VITE_API_URL' };

    try {
      const url = new URL(`/api/vendors/${encodeURIComponent(id)}`, apiBaseUrl);
      const res = await fetch(url.toString());
      const json: any = await res.json().catch(() => null);

      if (!res.ok) {
        return { data: null as VendorWithUser | null, error: json?.error || `Failed to fetch vendor (${res.status})` };
      }

      return { data: json?.data as VendorWithUser, error: null as string | null };
    } catch (e: any) {
      return { data: null as VendorWithUser | null, error: e?.message || 'Failed to fetch vendor' };
    }
  }, []);

  const getVendorByUserId = useCallback(async (userId: string) => {
    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl) {
      return { data: null as VendorWithUser | null, error: 'Missing VITE_API_URL' };
    }

    try {
      const url = new URL(`/api/vendors/by-user/${encodeURIComponent(userId)}`, apiBaseUrl);
      const res = await fetch(url.toString());
      const json: any = await res.json().catch(() => null);

      if (!res.ok) {
        return { data: null as VendorWithUser | null, error: json?.error || `Failed to fetch vendor profile (${res.status})` };
      }

      return { data: json?.data as VendorWithUser, error: null as string | null };
    } catch (e: any) {
      return { data: null as VendorWithUser | null, error: e?.message || 'Failed to fetch vendor profile' };
    }
  }, []);

  // Writes (still Supabase-direct for now)
  const createVendor = useCallback(async (vendorData: {
    business_name: string;
    business_description?: string;
    category: string;
    contact_email?: string;
    contact_phone?: string;
    business_address?: string;
    business_logo?: string;
  }) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const userId = userData.user.id;

      // Ensure there's a matching public.users row (after switching Supabase projects)
      const { data: existingUser, error: userSelectError } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single() as any;

      if (userSelectError) {
        const insertPayload = {
          id: userId,
          email: userData.user.email ?? null,
          name:
            (userData.user.user_metadata as any)?.name ||
            (userData.user.user_metadata as any)?.full_name ||
            (userData.user.email ? String(userData.user.email).split('@')[0] : 'User'),
          role: 'student',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: userInsertError } = await supabase
          .from('users')
          .insert(insertPayload);

        if (userInsertError) throw userInsertError;
      }

      const { data, error } = await supabase
        .from('vendors')
        .insert({
          ...vendorData,
          user_id: userId,
        })
        .select()
        .single() as any;

      if (error) throw error;

      await supabase
        .from('users')
        .update({ role: 'vendor' })
        .eq('id', userId) as any;

      return { data: data as Vendor, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }, []);

  const updateVendor = useCallback(async (id: string, updates: Partial<Vendor>) => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .update(updates)
        .eq('id', id)
        .select()
        .single() as any;

      if (error) throw error;
      return { data: data as Vendor, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }, []);

  const featureVendor = useCallback(async (vendorId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data, error } = await supabase
        .from('vendors')
        .update({
          is_featured: true,
          featured_expires_at: expiresAt.toISOString(),
        })
        .eq('id', vendorId)
        .select()
        .single() as any;

      if (error) throw error;
      return { data: data as Vendor, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }, []);

  const verifyVendor = useCallback(async (vendorId: string) => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .update({
          is_verified: true,
          verification_fee_paid: true,
          verification_paid_at: new Date().toISOString(),
        })
        .eq('id', vendorId)
        .select()
        .single() as any;

      if (error) throw error;
      return { data: data as Vendor, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }, []);

  return {
    vendors,
    loading,
    getVendors,
    getVendor,
    getVendorByUserId,
    createVendor,
    updateVendor,
    featureVendor,
    verifyVendor,
  };
}
