import { useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  const { isAuthenticated } = useAuth();
  const { 
    notifications, 
    loading, 
    getNotifications, 
    markAsRead, 
    deleteNotification 
  } = useNotifications();

  useEffect(() => {
    if (isAuthenticated) {
      getNotifications();
    }
  }, [isAuthenticated]);

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

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          </div>
          {unreadNotifications.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => markAsRead()}
            >
              <Check className="h-4 w-4 mr-2" />
              Mark all as read
            </Button>
          )}
        </div>

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
                      onMarkAsRead={() => markAsRead(notification.id)}
                      onDelete={() => deleteNotification(notification.id)}
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
                      onMarkAsRead={() => {}}
                      onDelete={() => deleteNotification(notification.id)}
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
  onMarkAsRead: () => void;
  onDelete: () => void;
  isRead?: boolean;
}

function NotificationItem({ 
  notification, 
  icon, 
  link, 
  onMarkAsRead, 
  onDelete,
  isRead = false 
}: NotificationItemProps) {
  return (
    <Link to={link} onClick={onMarkAsRead}>
      <Card className={`hover:shadow-md transition-shadow ${!isRead ? 'bg-emerald-50 border-emerald-200' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={`font-medium ${!isRead ? 'text-gray-900' : 'text-gray-600'}`}>
                    {notification.title}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{notification.message}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {formatRelativeTime(notification.created_at)}
                  </p>
                </div>
                {!isRead && (
                  <Badge className="bg-emerald-600 flex-shrink-0">New</Badge>
                )}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete();
              }}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
