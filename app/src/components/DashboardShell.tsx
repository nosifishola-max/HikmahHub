import { ReactNode, useMemo } from 'react';
import { LayoutDashboard, Store, ShieldCheck, StoreIcon, User, Bell, CreditCard, Settings, MessageSquareText, ClipboardList, Wallet, Users } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks';
import { useAuthContext } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

type Role = 'customer' | 'vendor' | 'admin';

type NavItem = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
  badge?: number;
};

export type DashboardShellProps = {
  role: Role;
  title: string;
  children: ReactNode;
  rightSlot?: ReactNode;
};

const roleLabel: Record<Role, string> = {
  customer: 'Customer Dashboard',
  vendor: 'Vendor Dashboard',
  admin: 'Admin Dashboard',
};

const navItems: NavItem[] = [
  { label: 'Overview', to: '/dashboard', icon: LayoutDashboard, roles: ['customer', 'vendor', 'admin'] },
  { label: 'Browse Listings', to: '/dashboard/browse', icon: StoreIcon, roles: ['customer'] },
  { label: 'Saved Items', to: '/dashboard/saved', icon: ClipboardList, roles: ['customer'] },
  { label: 'Messages', to: '/messages', icon: MessageSquareText, roles: ['customer', 'vendor'] },
  { label: 'Orders', to: '/dashboard/orders', icon: Wallet, roles: ['customer'] },
  { label: 'Notifications', to: '/notifications', icon: Bell, roles: ['customer', 'vendor'] },
  { label: 'Wallet', to: '/wallet', icon: CreditCard, roles: ['customer', 'vendor'] },

  { label: 'Listings', to: '/vendor/listings', icon: Store, roles: ['vendor'] },
  { label: 'Customers', to: '/vendor/customers', icon: Users, roles: ['vendor'] },
  { label: 'Analytics', to: '/vendor/analytics', icon: ShieldCheck, roles: ['vendor'] },
  { label: 'Marketing', to: '/vendor/marketing', icon: Settings, roles: ['vendor'] },
  { label: 'Wallet & Earnings', to: '/vendor/wallet', icon: CreditCard, roles: ['vendor'] },
  { label: 'Verification', to: '/vendor/verification', icon: ShieldCheck, roles: ['vendor'] },

  { label: 'Users', to: '/admin/users', icon: Users, roles: ['admin'] },
  { label: 'Vendors', to: '/admin/vendors', icon: Store, roles: ['admin'] },
  { label: 'Verification Requests', to: '/admin/verification', icon: ShieldCheck, roles: ['admin'] },
  { label: 'Reports', to: '/admin/reports', icon: ClipboardList, roles: ['admin'] },
  { label: 'Settings', to: '/admin/settings', icon: Settings, roles: ['admin'] },

  { label: 'Our Team', to: '/team', icon: User, roles: ['customer', 'vendor', 'admin'] },
];

export function DashboardShell({ role, title, children, rightSlot }: DashboardShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAuthenticated } = useAuthContext();

  const itemsForRole = useMemo(() => navItems.filter((i) => i.roles.includes(role)), [role]);

  return (
    <div className="min-h-[calc(100vh-0px)] bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden lg:block w-72 shrink-0 border-r border-gray-200 bg-white">
          <div className="p-5 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
                HH
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-500">{roleLabel[role]}</p>
                <p className="font-bold text-gray-900 truncate">{title}</p>
              </div>
            </div>

            {rightSlot ? <div className="mt-3">{rightSlot}</div> : null}
          </div>

          <nav className="p-3 space-y-1">
            {itemsForRole.map((item) => {
              const isActive = location.pathname === item.to;
              const Icon = item.icon;

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-emerald-50 text-emerald-800' : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <Icon className={cn('h-4 w-4', isActive ? 'text-emerald-700' : 'text-gray-500')} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {!isAuthenticated ? (
            <div className="p-4">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate('/login')}>
                Sign in
              </Button>
            </div>
          ) : null}
        </aside>

        {/* Mobile quick header */}
        <div className="flex-1 min-w-0">
          <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
                  HH
                </div>
                <div>
                  <p className="text-xs text-gray-500">{roleLabel[role]}</p>
                  <p className="font-bold text-gray-900 text-sm">{title}</p>
                </div>
              </div>
              {rightSlot ? <div className="ml-2">{rightSlot}</div> : null}
            </div>
          </header>

          <AnimatePresence mode="wait">
            <motion.main
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              className="p-4 sm:p-6 lg:p-8"
            >
              <Card className="border-gray-200 shadow-sm bg-white">
                <div className="p-4 sm:p-6 lg:p-7">{children}</div>
              </Card>
            </motion.main>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
