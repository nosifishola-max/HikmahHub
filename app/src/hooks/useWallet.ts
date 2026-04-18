import { useState, useCallback } from 'react';
import { supabase, PRICING } from '@/lib/supabase';
import type { Transaction } from '@/lib/supabase';

export function useWallet() {
  const [loading, setLoading] = useState(false);

  const getTransactions = useCallback(async () => {
    if (!supabase) {
      // Mock transactions for development
      return { data: [], error: null };
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data: (data || []) as Transaction[], error: null };
    } catch (error: any) {
      return { data: [], error };
    }
  }, []);

  const processPayment = useCallback(async ({
    amount,
    type,
    reference,
    metadata = {},
  }: {
    amount: number;
    type: Transaction['type'];
    reference: string;
    metadata?: Record<string, any>;
  }) => {
    if (!supabase) {
      // Mock payment processing for development
      console.log('Mock payment processed:', { amount, type, reference, metadata });
      setLoading(false);
      return { success: true, error: null };
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // Create transaction record
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: userData.user.id,
          amount,
          type,
          status: 'success',
          reference,
          metadata,
        })
        .select()
        .single() as any;

      if (txError) throw txError;

      // Calculate and add cashback (5%)
      const cashbackAmount = amount * PRICING.CASHBACK.RATE;
      
      // Update user wallet and stats
      const { error: userError } = await supabase.rpc('process_cashback', {
        p_user_id: userData.user.id,
        p_transaction_id: (transaction as any).id,
        p_amount: amount,
      });

      if (userError) {
        // Fallback if RPC not available
        const { data: user } = await supabase
          .from('users')
          .select('wallet_balance, total_spent, total_cashback_earned')
          .eq('id', userData.user.id)
          .single() as any;

        await supabase
          .from('users')
          .update({
            wallet_balance: (user?.wallet_balance || 0) + cashbackAmount,
            total_spent: (user?.total_spent || 0) + amount,
            total_cashback_earned: (user?.total_cashback_earned || 0) + cashbackAmount,
          })
          .eq('id', userData.user.id) as any;
      }

      // Check for referral reward on first payment
      const { data: user } = await supabase
        .from('users')
        .select('referred_by, total_spent')
        .eq('id', userData.user.id)
        .single() as any;

      if (user?.referred_by && amount >= PRICING.REFERRAL.MIN_PAYMENT) {
        // Check if this is first payment
        const { data: previousPayments } = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', userData.user.id)
          .eq('status', 'success')
          .neq('type', 'cashback')
          .neq('type', 'referral_reward')
          .limit(2);

        if (previousPayments && previousPayments.length <= 1) {
          // First payment - process referral
          await supabase.rpc('process_referral_reward', {
            p_referred_user_id: userData.user.id,
          });
        }
      }

      return { data: transaction as Transaction, cashback: cashbackAmount, error: null };
    } catch (error: any) {
      return { data: null, cashback: 0, error };
    } finally {
      setLoading(false);
    }
  }, []);

  const useWalletBalance = useCallback(async (amount: number, type: Transaction['type'], metadata = {}) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // Check balance
      const { data: user } = await supabase
        .from('users')
        .select('wallet_balance')
        .eq('id', userData.user.id)
        .single() as any;

      if (!user || user.wallet_balance < amount) {
        throw new Error('Insufficient wallet balance');
      }

      // Deduct from wallet
      const { error: updateError } = await supabase
        .from('users')
        .update({
          wallet_balance: user.wallet_balance - amount,
        })
        .eq('id', userData.user.id) as any;

      if (updateError) throw updateError;

      // Create transaction
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: userData.user.id,
          amount,
          type,
          status: 'success',
          metadata,
        })
        .select()
        .single() as any;

      if (txError) throw txError;

      return { data: transaction as Transaction, error: null };
    } catch (error: any) {
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  }, []);

  const getWalletBalance = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('users')
        .select('wallet_balance, total_spent, total_cashback_earned')
        .eq('id', userData.user.id)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }, []);

  return {
    loading,
    getTransactions,
    processPayment,
    useWalletBalance,
    getWalletBalance,
  };
}
