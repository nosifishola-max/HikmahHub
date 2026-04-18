import { Link, useLocation } from 'react-router-dom';
import { Home, Store, PlusCircle, MessageSquare, User } from 'lucide-react';
import { useChat } from '@/hooks';

interface NavItem {
  path: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
}

export function BottomNav() {
  const location = useLocation();
  const { unreadCount: chatUnreadCount } = useChat();

  const navItems: NavItem[] = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/marketplace', icon: Store, label: 'Market' },
    { path: '/create-listing', icon: PlusCircle, label: 'Sell' },
    { path: '/messages', icon: MessageSquare, label: 'Messages', badge: chatUnreadCount },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full ${
                isActive ? 'text-emerald-600' : 'text-gray-500'
              }`}
            >
              <div className="relative">
                <Icon className={`h-6 w-6 ${isActive ? 'text-emerald-600' : 'text-gray-500'}`} />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-xs mt-1 ${isActive ? 'font-medium' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
