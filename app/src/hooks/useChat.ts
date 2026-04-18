import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Chat, Message, User } from '@/lib/supabase';

export interface ChatWithUsers extends Chat {
  buyer?: User;
  seller?: User;
  listing?: { title: string; images: string[]; price: number };
}

export interface MessageWithSender extends Message {
  sender?: User;
}

export function useChat() {
  const [chats, setChats] = useState<ChatWithUsers[]>([]);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!supabase) return; // Skip if no supabase client

    const subscription = supabase
      .channel('messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMessage = payload.new as Message;
          setMessages(prev => [...prev, newMessage as MessageWithSender]);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const getChats = useCallback(async () => {
    if (!supabase) {
      // Mock chats for development
      setChats([]);
      return { data: [], error: null };
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('chats')
        .select(`
          *,
          buyer:users!chats_buyer_id_fkey(*),
          seller:users!chats_seller_id_fkey(*),
          listing:listings(title, images, price)
        `)
        .or(`buyer_id.eq.${userData.user.id},seller_id.eq.${userData.user.id}`)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      const typedChats = (data || []) as ChatWithUsers[];
      setChats(typedChats);
      
      // Calculate unread count
      const unread = typedChats.reduce((acc, chat) => {
        if (chat.buyer_id === userData.user!.id) {
          return acc + (chat.buyer_unread || 0);
        } else {
          return acc + (chat.seller_unread || 0);
        }
      }, 0);
      setUnreadCount(unread);

      return { data: typedChats, error: null };
    } catch (error: any) {
      return { data: [], error };
    } finally {
      setLoading(false);
    }
  }, []);

  const getMessages = useCallback(async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users(*)
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const typedMessages = (data || []) as MessageWithSender[];
      setMessages(typedMessages);
      return { data: typedMessages, error: null };
    } catch (error: any) {
      return { data: [], error };
    }
  }, []);

  const startChat = useCallback(async (listingId: string, sellerId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // Check if chat already exists
      const { data: existingChat } = await supabase
        .from('chats')
        .select('*')
        .eq('listing_id', listingId)
        .eq('buyer_id', userData.user.id)
        .eq('seller_id', sellerId)
        .single() as any;

      if (existingChat) {
        return { data: existingChat as Chat, error: null };
      }

      // Create new chat
      const { data, error } = await supabase
        .from('chats')
        .insert({
          listing_id: listingId,
          buyer_id: userData.user.id,
          seller_id: sellerId,
        })
        .select()
        .single() as any;

      if (error) throw error;
      return { data: data as Chat, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }, []);

  const sendMessage = useCallback(async (chatId: string, content: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // Create message
      const { data: message, error: msgError } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: userData.user.id,
          content,
        })
        .select()
        .single() as any;

      if (msgError) throw msgError;

      // Update chat
      const { data: chat } = await supabase
        .from('chats')
        .select('buyer_id, seller_id, buyer_unread, seller_unread')
        .eq('id', chatId)
        .single() as any;

      if (chat) {
        const isBuyer = chat.buyer_id === userData.user.id;
        const updateData: any = {
          last_message: content,
          last_message_at: new Date().toISOString(),
        };
        updateData[isBuyer ? 'seller_unread' : 'buyer_unread'] = (isBuyer ? (chat.seller_unread || 0) : (chat.buyer_unread || 0)) + 1;
        
        await supabase
          .from('chats')
          .update(updateData)
          .eq('id', chatId) as any;
      }

      return { data: message as Message, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }, []);

  const markAsRead = useCallback(async (chatId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: chat } = await supabase
        .from('chats')
        .select('buyer_id')
        .eq('id', chatId)
        .single() as any;

      if (chat) {
        const isBuyer = chat.buyer_id === userData.user.id;
        const updateData: any = {};
        updateData[isBuyer ? 'buyer_unread' : 'seller_unread'] = 0;
        
        await supabase
          .from('chats')
          .update(updateData)
          .eq('id', chatId) as any;

        // Mark messages as read
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('chat_id', chatId)
          .neq('sender_id', userData.user.id)
          .eq('is_read', false) as any;
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, []);

  return {
    chats,
    messages,
    loading,
    unreadCount,
    getChats,
    getMessages,
    startChat,
    sendMessage,
    markAsRead,
  };
}
