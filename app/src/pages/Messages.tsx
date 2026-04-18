import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Send, 
  ArrowLeft, 
  MoreVertical,
  Phone,
  Image as ImageIcon,
  Check,
  CheckCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Layout } from '@/components/Layout';
import { useAuth, useChat } from '@/hooks';
import { formatRelativeTime } from '@/lib/supabase';
import type { ChatWithUsers, MessageWithSender } from '@/hooks/useChat';

export function Messages() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chatId = searchParams.get('chat');
  const { user, isAuthenticated } = useAuth();
  const { 
    chats, 
    messages, 
    loading, 
    getChats, 
    getMessages, 
    sendMessage, 
    markAsRead 
  } = useChat();
  
  const [selectedChat, setSelectedChat] = useState<ChatWithUsers | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = window.innerWidth < 768;

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    getChats();
  }, [isAuthenticated]);

  useEffect(() => {
    if (chatId) {
      const chat = chats.find(c => c.id === chatId);
      if (chat) {
        setSelectedChat(chat);
        getMessages(chatId);
        markAsRead(chatId);
      }
    }
  }, [chatId, chats]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSelectChat = (chat: ChatWithUsers) => {
    setSelectedChat(chat);
    getMessages(chat.id);
    markAsRead(chat.id);
    navigate(`/messages?chat=${chat.id}`);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedChat) return;

    setSending(true);
    await sendMessage(selectedChat.id, messageText.trim());
    setMessageText('');
    setSending(false);
    scrollToBottom();
  };

  const getOtherUser = (chat: ChatWithUsers) => {
    return chat.buyer_id === user?.id ? chat.seller : chat.buyer;
  };

  const getUnreadCount = (chat: ChatWithUsers) => {
    return chat.buyer_id === user?.id ? chat.buyer_unread : chat.seller_unread;
  };

  if (!isAuthenticated) return null;

  // Mobile: Show chat list or chat detail
  if (isMobile && selectedChat) {
    return (
      <Layout>
        <ChatDetail 
          chat={selectedChat}
          messages={messages}
          otherUser={getOtherUser(selectedChat)!}
          currentUserId={user!.id}
          messageText={messageText}
          setMessageText={setMessageText}
          sending={sending}
          onSend={handleSendMessage}
          onBack={() => {
            setSelectedChat(null);
            navigate('/messages');
          }}
          messagesEndRef={messagesEndRef}
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)]">
        <div className="grid md:grid-cols-3 h-full bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Chat List */}
          <div className={`border-r border-gray-200 ${selectedChat && isMobile ? 'hidden' : ''}`}>
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Messages</h2>
            </div>
            <div className="overflow-y-auto h-[calc(100%-4rem)]">
              {loading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
              ) : chats.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-4xl mb-2">💬</div>
                  <p className="text-gray-500">No messages yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Start a conversation from a listing
                  </p>
                </div>
              ) : (
                chats.map((chat) => {
                  const otherUser = getOtherUser(chat);
                  const unreadCount = getUnreadCount(chat);
                  
                  return (
                    <button
                      key={chat.id}
                      onClick={() => handleSelectChat(chat)}
                      className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                        selectedChat?.id === chat.id ? 'bg-emerald-50' : ''
                      }`}
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={otherUser?.profile_image || ''} />
                        <AvatarFallback>{otherUser?.name?.[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">{otherUser?.name}</p>
                          {chat.last_message_at && (
                            <span className="text-xs text-gray-400">
                              {formatRelativeTime(chat.last_message_at)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {chat.listing?.title && (
                            <span className="text-emerald-600">Re: {chat.listing.title}</span>
                          )}
                        </p>
                        {chat.last_message && (
                          <p className="text-sm text-gray-600 truncate">{chat.last_message}</p>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <Badge className="bg-emerald-600">{unreadCount}</Badge>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat Detail */}
          <div className={`md:col-span-2 ${!selectedChat ? 'hidden md:flex' : ''}`}>
            {selectedChat ? (
              <ChatDetail 
                chat={selectedChat}
                messages={messages}
                otherUser={getOtherUser(selectedChat)!}
                currentUserId={user!.id}
                messageText={messageText}
                setMessageText={setMessageText}
                sending={sending}
                onSend={handleSendMessage}
                onBack={() => setSelectedChat(null)}
                messagesEndRef={messagesEndRef}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <div className="text-6xl mb-4">💬</div>
                  <p>Select a conversation to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

interface ChatDetailProps {
  chat: ChatWithUsers;
  messages: MessageWithSender[];
  otherUser: { name: string; profile_image: string | null; phone: string | null };
  currentUserId: string;
  messageText: string;
  setMessageText: (text: string) => void;
  sending: boolean;
  onSend: (e: React.FormEvent) => void;
  onBack: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

function ChatDetail({
  chat,
  messages,
  otherUser,
  currentUserId,
  messageText,
  setMessageText,
  sending,
  onSend,
  onBack,
  messagesEndRef,
}: ChatDetailProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-10 w-10">
          <AvatarImage src={otherUser?.profile_image || ''} />
          <AvatarFallback>{otherUser?.name?.[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="font-medium">{otherUser?.name}</p>
          {chat.listing && (
            <p className="text-xs text-emerald-600 truncate">Re: {chat.listing.title}</p>
          )}
        </div>
        <Button variant="ghost" size="icon">
          <Phone className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p>No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwn = message.sender_id === currentUserId;
            
            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    isOwn
                      ? 'bg-emerald-600 text-white rounded-br-none'
                      : 'bg-gray-100 text-gray-900 rounded-bl-none'
                  }`}
                >
                  <p>{message.content}</p>
                  <div className={`flex items-center justify-end gap-1 mt-1 ${isOwn ? 'text-emerald-200' : 'text-gray-400'}`}>
                    <span className="text-xs">
                      {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isOwn && (
                      message.is_read ? (
                        <CheckCheck className="h-3 w-3" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={onSend} className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon">
            <ImageIcon className="h-5 w-5" />
          </Button>
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button 
            type="submit" 
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={!messageText.trim() || sending}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
