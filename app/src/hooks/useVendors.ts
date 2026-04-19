import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Vendor, User } from '@/lib/supabase';

export interface VendorWithUser extends Vendor {
  user?: User;
}

export function useVendors() {
  const [vendors, setVendors] = useState<VendorWithUser[]>([]);
  const [loading, setLoading] = useState(false);

  const getVendors = useCallback(async (filters?: {
    featured?: boolean;
    category?: string;
    verified?: boolean;
  }) => {
    setLoading(true);
    try {
      let query = supabase
        .from('vendors')
        .select(`
          *,
          user:users(*)
        `)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters?.featured) {
        query = query.eq('is_featured', true);
      }

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      if (filters?.verified) {
        query = query.eq('is_verified', true);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter out expired featured vendors
      const now = new Date().toISOString();
      const processedVendors = (data || []).map((vendor: any) => ({
        ...vendor,
        is_featured: vendor.is_featured && vendor.featured_expires_at && vendor.featured_expires_at > now,
      }));

      setVendors(processedVendors);
      return { data: processedVendors as VendorWithUser[], error: null };
    } catch (error: any) {
      return { data: [], error };
    } finally {
      setLoading(false);
    }
  }, []);

  const getVendor = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select(`
          *,
          user:users(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return { data: data as VendorWithUser, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }, []);

  const getVendorByUserId = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select(`
          *,
          user:users(*)
        `)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return { data: data as VendorWithUser, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }, []);

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

      const { data, error } = await supabase
        .from('vendors')
        .insert({
          ...vendorData,
          user_id: userData.user.id,
        })
        .select()
        .single() as any;

      if (error) throw error;

      // Update user role
      await supabase
        .from('users')
        .update({ role: 'vendor' })
        .eq('id', userData.user.id) as any;

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
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

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
