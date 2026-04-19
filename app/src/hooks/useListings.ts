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
    try {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          *,
          user:users(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return { data: data as ListingWithUser, error: null };
    } catch (error: any) {
      return { data: null, error };
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

      // Check if user has used free listing
      const { data: user } = await supabase
        .from('users')
        .select('free_listing_used, listings_count')
        .eq('id', userData.user.id)
        .single() as any;

      const listingFee = user?.free_listing_used ? PRICING.LISTING.SUBSEQUENT : 0;

      const { data, error } = await supabase
        .from('listings')
        .insert({
          ...listingData,
          user_id: userData.user.id,
          listing_fee_paid: !user?.free_listing_used,
          listing_fee_amount: listingFee,
        })
        .select()
        .single() as any;

      if (error) throw error;

      // Update user's listing count
      await supabase
        .from('users')
        .update({
          free_listing_used: true,
          listings_count: (user?.listings_count || 0) + 1,
        })
        .eq('id', userData.user.id) as any;

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
