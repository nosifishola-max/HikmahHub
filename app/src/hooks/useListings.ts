import { useState, useCallback } from 'react';
import { supabase, PRICING } from '@/lib/supabase';
import type { Listing, User } from '@/lib/supabase';

export interface ListingWithUser extends Listing {
  user?: User;
}

export function useListings() {
  const [listings, setListings] = useState<ListingWithUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(async (filters?: {
    category?: string;
    search?: string;
    userId?: string;
    boosted?: boolean;
  }) => {
    // Mock listings for development (always available)
    const mockListings: ListingWithUser[] = [
      {
        id: '1',
        title: 'Sample Laptop',
        description: 'A great laptop for students',
        price: 150000,
        category: 'electronics',
        condition: 'like_new',
        images: [],
        user_id: 'mock-user',
        status: 'active',
        is_boosted: false,
        boost_type: null,
        boost_expires_at: null,
        listing_fee_paid: true,
        listing_fee_amount: 200,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    ];

    // If we're in placeholder mode, return mock data
    if (!supabase) {
      setListings(mockListings);
      return { data: mockListings, error: null };
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('listings')
        .select(`
          *,
          user:users(*)
        `)
        .eq('status', 'active')
        .order('is_boosted', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter out expired boosts
      const now = new Date().toISOString();
      const processedListings = (data || []).map((listing: any) => ({
        ...listing,
        is_boosted: listing.is_boosted && listing.boost_expires_at && listing.boost_expires_at > now,
      }));

      setListings(processedListings);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const getListing = useCallback(async (id: string) => {
    const apiBaseUrl = import.meta.env.VITE_API_URL as string | undefined;

    if (!apiBaseUrl) {
      return { data: null as ListingWithUser | null, error: 'Missing VITE_API_URL' };
    }

    try {
      const url = new URL(`/api/listings/${encodeURIComponent(id)}`, apiBaseUrl.replace(/\/+$/, ''));
      const res = await fetch(url.toString());
      const json: any = await res.json().catch(() => null);

      if (!res.ok) {
        return { data: null as ListingWithUser | null, error: json?.error || `Failed to fetch listing (${res.status})` };
      }

      return { data: json?.data as ListingWithUser, error: null as string | null };
    } catch (error: any) {
      return { data: null as ListingWithUser | null, error: error?.message || 'Failed to fetch listing' };
    }
  }, []);

  const createListing = useCallback(async (listingData: {
    title: string;
    description: string;
    price: number;
    category: string;
    condition?: string;
    images: string[];
  }) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const userId = userData.user.id;

      // Ensure there's a matching public.users row (after switching Supabase projects)
      // backend already auto-provisions this row; the frontend needs the same for direct writes.
      const { data: existingUser, error: userSelectError } = await supabase
        .from('users')
        .select('id, free_listing_used, listings_count')
        .eq('id', userId)
        .single() as any;

      if (userSelectError) {
        // If the row doesn't exist, create it; otherwise rethrow.
        const insertPayload = {
          id: userId,
          email: userData.user.email ?? null,
          name: (userData.user.user_metadata?.name as string | undefined) || (userData.user.email ? String(userData.user.email).split('@')[0] : 'User'),
          role: 'student',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: createdUser, error: userInsertError } = await supabase
          .from('users')
          .insert(insertPayload)
          .select('id, free_listing_used, listings_count')
          .single() as any;

        if (userInsertError) throw userInsertError;

        return await createListing({
          ...listingData,
          // keep params same; we just used recursion to reuse the same code path
        } as any);
      }

      const listingFee = existingUser?.free_listing_used ? PRICING.LISTING.SUBSEQUENT : 0;

      const { data, error } = await supabase
        .from('listings')
        .insert({
          ...listingData,
          user_id: userId,
          listing_fee_paid: !existingUser?.free_listing_used,
          listing_fee_amount: listingFee,
        })
        .select()
        .single() as any;

      if (error) throw error;

      await supabase
        .from('users')
        .update({
          free_listing_used: true,
          listings_count: (existingUser?.listings_count || 0) + 1,
        })
        .eq('id', userId) as any;

      return { data: data as Listing, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }, []);

  const updateListing = useCallback(async (id: string, updates: Partial<Listing>) => {
    try {
      const { data, error } = await supabase
        .from('listings')
        .update(updates)
        .eq('id', id)
        .select()
        .single() as any;

      if (error) throw error;
      return { data: data as Listing, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }, []);

  const deleteListing = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('listings')
        .update({ status: 'deleted' })
        .eq('id', id) as any;

      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  }, []);

  const boostListing = useCallback(async (listingId: string, boostType: 'featured' | 'urgent' | 'premium') => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const boostPrices = {
        featured: { amount: PRICING.BOOST.FEATURED, hours: 48 },
        urgent: { amount: PRICING.BOOST.URGENT, hours: 24 },
        premium: { amount: PRICING.BOOST.PREMIUM, hours: 72 },
      };

      const boost = boostPrices[boostType];
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + boost.hours);

      // Create boost record
      const { data: boostData, error: boostError } = await supabase
        .from('boosts')
        .insert({
          listing_id: listingId,
          user_id: userData.user.id,
          type: boostType,
          amount: boost.amount,
          duration_hours: boost.hours,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single() as any;

      if (boostError) throw boostError;

      // Update listing
      const { data, error } = await supabase
        .from('listings')
        .update({
          is_boosted: true,
          boost_type: boostType,
          boost_expires_at: expiresAt.toISOString(),
        })
        .eq('id', listingId)
        .select()
        .single() as any;

      if (error) throw error;

      return { data: data as Listing, boostData, error: null };
    } catch (error: any) {
      return { data: null, boostData: null, error };
    }
  }, []);

  return {
    listings,
    loading,
    error,
    fetchListings,
    getListing,
    createListing,
    updateListing,
    deleteListing,
    boostListing,
  };
}
