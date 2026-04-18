import { useState, useCallback } from 'react';
import { PRICING } from '@/lib/supabase';

const API_BASE_URL = 'http://localhost:3001/api';

export interface PaymentResponse {
  success: boolean;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
  error?: string;
}

export interface VerificationResponse {
  success: boolean;
  data?: {
    reference: string;
    status: string;
    amount: number;
    customer: any;
    metadata: any;
  };
  error?: string;
}

export function usePaystack() {
  const [loading, setLoading] = useState(false);

  const initializePayment = useCallback(async ({
    email,
    amount,
    metadata = {},
    type,
    boostType,
  }: {
    email: string;
    amount: number;
    metadata?: Record<string, any>;
    type?: string;
    boostType?: string;
  }): Promise<PaymentResponse> => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/paystack/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          amount,
          metadata,
          type,
          boostType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment initialization failed');
      }

      return data;
    } catch (error: any) {
      console.error('Payment initialization error:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyPayment = useCallback(async (reference: string): Promise<VerificationResponse> => {
    try {
      const response = await fetch(`${API_BASE_URL}/paystack/verify/${reference}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment verification failed');
      }

      return data;
    } catch (error: any) {
      console.error('Payment verification error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const payForListing = useCallback(async ({
    email,
    isFirstListing,
    onSuccess,
    onCancel,
  }: {
    email: string;
    isFirstListing: boolean;
    onSuccess?: (reference: string) => void;
    onCancel?: () => void;
  }) => {
    const amount = isFirstListing ? 0 : PRICING.LISTING.SUBSEQUENT;

    if (amount === 0) {
      onSuccess?.('FREE');
      return { success: true, data: { reference: 'FREE' } };
    }

    const result = await initializePayment({
      email,
      amount,
      type: 'listing_fee',
    });

    if (result.success && result.data) {
      // Open payment URL in new window/tab
      window.open(result.data.authorization_url, '_blank');

      // For demo purposes, we'll simulate success
      // In production, you'd want to poll for payment status or use webhooks
      setTimeout(() => {
        onSuccess?.(result.data!.reference);
      }, 2000);
    } else {
      onCancel?.();
    }

    return result;
  }, [initializePayment]);

  const payForBoost = useCallback(async ({
    email,
    boostType,
    onSuccess,
    onCancel,
  }: {
    email: string;
    boostType: 'featured' | 'urgent' | 'premium';
    onSuccess?: (reference: string) => void;
    onCancel?: () => void;
  }) => {
    const amount = PRICING.BOOST[boostType.toUpperCase() as keyof typeof PRICING.BOOST];

    const result = await initializePayment({
      email,
      amount,
      type: 'boost',
      boostType,
    });

    if (result.success && result.data) {
      window.open(result.data.authorization_url, '_blank');

      setTimeout(() => {
        onSuccess?.(result.data!.reference);
      }, 2000);
    } else {
      onCancel?.();
    }

    return result;
  }, [initializePayment]);

  const payForVendorVerification = useCallback(async ({
    email,
    onSuccess,
    onCancel,
  }: {
    email: string;
    onSuccess?: (reference: string) => void;
    onCancel?: () => void;
  }) => {
    const result = await initializePayment({
      email,
      amount: PRICING.VENDOR.VERIFICATION,
      type: 'vendor_verification',
    });

    if (result.success && result.data) {
      window.open(result.data.authorization_url, '_blank');

      setTimeout(() => {
        onSuccess?.(result.data!.reference);
      }, 2000);
    } else {
      onCancel?.();
    }

    return result;
  }, [initializePayment]);

  return {
    loading,
    initializePayment,
    verifyPayment,
    payForListing,
    payForBoost,
    payForVendorVerification,
  };
}
      metadata: { type: 'vendor_verification' h},
      onSuccess,
      onCancel,
    });
  }, [initializePayment]);

  const payForFeaturedVendor = useCallback(async ({
    email,
    onSuccess,
    onCancel,
  }: {
    email: string;
    onSuccess?: (reference: string) => void;
    onCancel?: () => void;
  }) => {
    return initializePayment({
      email,
      amount: PRICING.VENDOR.FEATURED,
      metadata: { type: 'vendor_featured' },
      onSuccess,
      onCancel,
    });
  }, [initializePayment]);

  return {
    loading,
    initializePayment,
    payForListing,
    payForBoost,
    payForVendorVerification,
    payForFeaturedVendor,
  };
}
