import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if we have valid credentials (not placeholders)
const hasValidCredentials = supabaseUrl && supabaseAnonKey &&
  !supabaseUrl.includes('placeholder') && !supabaseAnonKey.includes('placeholder');

export const supabase = hasValidCredentials
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null; // No real client when using placeholders

// Paystack configuration - moved to backend for security
// export const PAYSTACK_PUBLIC_KEY = 'sk_live_e3ee464203dbad85006f3d0869e21b2bff1c6697';

// Pricing constants
export const PRICING = {
  LISTING: {
    FIRST_FREE: true,
    SUBSEQUENT: 200,
  },
  BOOST: {
    FEATURED: 500,    // 48 hours, top of feed
    URGENT: 300,      // 24 hours, urgent badge
    PREMIUM: 1000,    // 72 hours, top + highlight
  },
  VENDOR: {
    VERIFICATION: 1500,  // One-time
    FEATURED: 1000,      // Weekly
  },
  CASHBACK: {
    RATE: 0.05,  // 5%
  },
  REFERRAL: {
    REWARD: 500,
    MIN_PAYMENT: 500,
  },
} as const;

// Helper functions
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatRelativeTime = (date: string | Date): string => {
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return formatDate(date);
};

export const generateReferralLink = (referralCode: string): string => {
  return `${window.location.origin}/signup?ref=${referralCode}`;
};

// Type definitions
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  department: string | null;
  level: string | null;
  campus: string;
  profile_image: string | null;
  role: 'student' | 'vendor' | 'admin';
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  wallet_balance: number;
  total_spent: number;
  total_cashback_earned: number;
  referral_code: string | null;
  referred_by: string | null;
  referral_earnings: number;
  listings_count: number;
  free_listing_used: boolean;
  created_at: string;
  updated_at: string;
}

export interface Listing {
  id: string;
  user_id: string;
  title: string;
  description: string;
  price: number;
  category: 'electronics' | 'fashion' | 'books' | 'services' | 'food' | 'accommodation' | 'others';
  condition: 'new' | 'used' | 'like_new' | null;
  images: string[];
  status: 'active' | 'sold' | 'reserved' | 'inactive' | 'deleted';
  is_boosted: boolean;
  boost_type: 'featured' | 'urgent' | 'premium' | null;
  boost_expires_at: string | null;
  listing_fee_paid: boolean;
  listing_fee_amount: number;
  created_at: string;
  updated_at: string;
}

export interface Boost {
  id: string;
  listing_id: string;
  user_id: string;
  type: 'featured' | 'urgent' | 'premium';
  amount: number;
  duration_hours: number;
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

export interface Vendor {
  id: string;
  user_id: string;
  business_name: string;
  business_description: string | null;
  category: string;
  contact_email: string | null;
  contact_phone: string | null;
  business_address: string | null;
  business_logo: string | null;
  is_verified: boolean;
  verification_fee_paid: boolean;
  verification_paid_at: string | null;
  is_featured: boolean;
  featured_expires_at: string | null;
  total_sales: number;
  rating: number;
  reviews_count: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'listing_fee' | 'boost_featured' | 'boost_urgent' | 'boost_premium' | 'vendor_verification' | 'vendor_featured' | 'wallet_topup' | 'cashback' | 'referral_reward' | 'wallet_payment' | 'refund';
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  reference: string | null;
  paystack_reference: string | null;
  listing_id: string | null;
  vendor_id: string | null;
  boost_id: string | null;
  cashback_amount: number;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface Chat {
  id: string;
  listing_id: string | null;
  buyer_id: string;
  seller_id: string;
  last_message: string | null;
  last_message_at: string | null;
  buyer_unread: number;
  seller_unread: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'offer';
  offer_amount: number | null;
  offer_status: 'pending' | 'accepted' | 'declined' | null;
  is_read: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'payment_success' | 'payment_failed' | 'cashback_received' | 'boost_activated' | 'boost_expired' | 'new_message' | 'listing_sold' | 'vendor_verified' | 'referral_completed' | 'system';
  title: string;
  message: string;
  related_id: string | null;
  related_type: string | null;
  is_read: boolean;
  created_at: string;
}
