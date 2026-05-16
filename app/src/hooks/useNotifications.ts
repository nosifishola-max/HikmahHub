import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Notification } from '@/lib/supabase';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Subscribe to realtime notifications
  useEffect(() => {
    let subscription: any;

    const setupSubscription = () => {
      try {
        subscription = supabase
          .channel('notifications')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications' },
            (payload) => {
              const newNotification = payload.new as Notification;
              console.log('[useNotifications] realtime INSERT received:', {
                notificationId: newNotification.id,
                user_id: newNotification.user_id,
                type: newNotification.type,
                is_read: newNotification.is_read,
              });

              setNotifications(prev => [newNotification, ...prev]);

              if (!newNotification.is_read) {
                setUnreadCount(prev => prev + 1);
              }
            }
          )
          .subscribe();
      } catch (error) {
        console.error('[useNotifications] subscription setup error:', error);
      }
    };

    // Load existing notifications on mount so the UI/badge is correct
    getNotifications().catch((e) => {
      console.error('[useNotifications] initial getNotifications failed:', e);
    });

    setupSubscription();

    return () => {
      if (subscription) {
        try {
          subscription.unsubscribe();
        } catch (error) {
          // Silently ignore unsubscribe errors
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const typedNotifications = (data || []) as Notification[];
      setNotifications(typedNotifications);
      setUnreadCount(typedNotifications.filter(n => !n.is_read).length);

      return { data: typedNotifications, error: null };
    } catch (error: any) {
      return { data: [], error };
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId?: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      if (notificationId) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notificationId)
          .eq('user_id', userData.user.id) as any;
      } else {
        // Mark all as read
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', userData.user.id)
          .eq('is_read', false) as any;
      }

      // Refresh notifications
      await getNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [getNotifications]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userData.user.id) as any;

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    getNotifications,
    markAsRead,
    deleteNotification,
  };
}
