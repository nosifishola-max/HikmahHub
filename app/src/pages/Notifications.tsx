import { useEffect, useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Check, 
  Trash2, 
  Bell,
  CreditCard,
  Gift,
  Zap,
  MessageSquare,
  Store,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layout } from '@/components/Layout';
import { useNotifications, useAuth } from '@/hooks';
import { formatRelativeTime } from '@/lib/supabase';
import type { Notification } from '@/types/database';

export function Notifications() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { 
    notifications, 
    loading, 
    error,
    getNotifications, 
    markAsRead, 
    deleteNotification 
  } = useNotifications();
  const [operationError, setOperationError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    getNotifications();
  }, [isAuthenticated, authLoading, navigate, getNotifications]);

  const handleMarkAllAsRead = async () => {
    try {
      setOperationError(null);
      await markAsRead();
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Failed to mark notifications as read');
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      setOperationError(null);
      await deleteNotification(id);
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Failed to delete notification');
    }
  };

  const handleNotificationClick = async (notification: Notification, link: string) => {
    try {
      setOperationError(null);
      if (!notification.is_read) {
        await markAsRead(notification.id);
      }
      navigate(link);
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Failed to process notification');
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'payment_success':
        return <CreditCard className="h-5 w-5 text-green-600" />;
      case 'payment_failed':
        return <CreditCard className="h-5 w-5 text-red-600" />;
      case 'cashback_received':
        return <Gift className="h-5 w-5 text-emerald-600" />;
      case 'boost_activated':
      case 'boost_expired':
        return <Zap className="h-5 w-5 text-amber-500" />;
      case 'new_message':
        return <MessageSquare className="h-5 w-5 text-blue-600" />;
      case 'vendor_verified':
        return <Store className="h-5 w-5 text-purple-600" />;
      case 'referral_completed':
        return <Users className="h-5 w-5 text-emerald-600" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getNotificationLink = (notification: Notification) => {
    switch (notification.type) {
      case 'new_message':
        return `/messages${notification.related_id ? `?chat=${notification.related_id}` : ''}`;
      case 'boost_activated':
      case 'boost_expired':
      case 'listing_sold':
        return notification.related_id ? `/listing/${notification.related_id}` : '/my-listings';
      case 'vendor_verified':
        return '/vendor-dashboard';
      case 'payment_success':
      case 'payment_failed':
      case 'cashback_received':
        return '/wallet';
      case 'referral_completed':
        return '/profile';
      default:
        return '#';
    }
  };

  const unreadNotifications = notifications.filter(n => !n.is_read);
  const readNotifications = notifications.filter(n => n.is_read);
    switch (type) {
      case 'payment_success':
        return <CreditCard className="h-5 w-5 text-green-600" />;
      case 'payment_failed':
        return <CreditCard className="h-5 w-5 text-red-600" />;
      case 'cashback_received':
        return <Gift className="h-5 w-5 text-emerald-600" />;
      case 'boost_activated':
      case 'boost_expired':
        return <Zap className="h-5 w-5 text-amber-500" />;
      case 'new_message':
        return <MessageSquare className="h-5 w-5 text-blue-600" />;
      case 'vendor_verified':
        return <Store className="h-5 w-5 text-purple-600" />;
      case 'referral_completed':
        return <Users className="h-5 w-5 text-emerald-600" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getNotificationLink = (notification: Notification) => {
    switch (notification.type) {
      case 'new_message':
        return `/messages${notification.related_id ? `?chat=${notification.related_id}` : ''}`;
      case 'boost_activated':
      case 'boost_expired':
      case 'listing_sold':
        return notification.related_id ? `/listing/${notification.related_id}` : '/my-listings';
      case 'vendor_verified':
        return '/vendor-dashboard';
      case 'payment_success':
      case 'payment_failed':
      case 'cashback_received':
        return '/wallet';
      case 'referral_completed':
        return '/profile';
      default:
        return '#';
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')} 
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          </div>
          {unreadNotifications.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleMarkAllAsRead}
              aria-label={`Mark ${unreadNotifications.length} notifications as read`}
            >
              <Check className="h-4 w-4 mr-2" />
              Mark all as read
            </Button>
          )}
        </div>

        {/* Error Message */}
        {(error || operationError) && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error || operationError}</p>
          </div>
        )}

        {/* Notifications List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse p-4 bg-gray-100 rounded-lg">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔔</div>
            <h3 className="text-lg font-medium text-gray-900">No notifications</h3>
            <p className="text-gray-500">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Unread */}
            {unreadNotifications.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-gray-500 mb-3">
                  New ({unreadNotifications.length})
                </h2>
                <div className="space-y-2">
                  {unreadNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      icon={getNotificationIcon(notification.type)}
                      link={getNotificationLink(notification)}
                      onNavigate={() => handleNotificationClick(notification, getNotificationLink(notification))}
                      onDelete={() => handleDeleteNotification(notification.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Read */}
            {readNotifications.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-gray-500 mb-3">
                  Earlier
                </h2>
                <div className="space-y-2">
                  {readNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      icon={getNotificationIcon(notification.type)}
                      link={getNotificationLink(notification)}
                      onNavigate={() => handleNotificationClick(notification, getNotificationLink(notification))}
                      onDelete={() => handleDeleteNotification(notification.id)}
                      isRead
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

interface NotificationItemProps {
  notification: Notification;
  icon: React.ReactNode;
  link: string;
  onNavigate: () => void;
  onDelete: () => void;
  isRead?: boolean;
}

const NotificationItem = memo(function NotificationItem({ 
  notification, 
  icon, 
  link, 
  onNavigate, 
  onDelete,
  isRead = false 
}: NotificationItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate();
  };

  const handleDelete = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete();
  };

  const handleDeleteKeydown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleDelete(e);
    }
  };

  return (
    <button
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick(e as any);
        }
      }}
      className="w-full text-left"
      aria-label={`${notification.title}: ${notification.message}`}
    >
      <Card 
        className={`hover:shadow-md transition-all ${
          !isRead ? 'bg-emerald-50 border-emerald-200 ring-1 ring-emerald-100' : 'hover:bg-gray-50'
        } cursor-pointer focus-within:ring-2 focus-within:ring-blue-500`}
        role="article"
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div 
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 border border-gray-200"
              aria-hidden="true"
            >
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className={`font-medium text-sm ${!isRead ? 'text-gray-900' : 'text-gray-600'}`}>
                    {notification.title}
                  </p>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{notification.message}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {formatRelativeTime(notification.created_at)}
                  </p>
                </div>
                {!isRead && (
                  <Badge 
                    className="bg-emerald-600 flex-shrink-0 ml-2"
                    aria-label="New notification"
                  >
                    New
                  </Badge>
                )}
              </div>
            </div>
            <button
              onClick={handleDelete}
              onKeyDown={handleDeleteKeydown}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded"
              aria-label={`Delete notification: ${notification.title}`}
              tabIndex={0}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </button>
  );
});
