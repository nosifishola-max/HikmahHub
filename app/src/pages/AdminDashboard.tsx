import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Store, 
  CreditCard, 
  Gift,
  Zap,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks';
import { supabase, formatCurrency, formatDate } from '@/lib/supabase';

export function AdminDashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useAuth();
  
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalVendors: 0,
    totalRevenue: 0,
    totalCashback: 0,
    activeBoosts: 0,
    pendingVerifications: 0,
  });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pendingVendors, setPendingVendors] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!isAdmin) {
      navigate('/');
      return;
    }

    loadDashboardData();
  }, [isAuthenticated, isAdmin]);

  const loadDashboardData = async () => {
    
    try {
      // Get stats
      const { count: userCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      const { count: vendorCount } = await supabase
        .from('vendors')
        .select('*', { count: 'exact', head: true });

      const { data: revenueData } = await supabase
        .from('transactions')
        .select('amount')
        .eq('status', 'success')
        .not('type', 'in', ['cashback', 'referral_reward', 'refund']);

      const { data: cashbackData } = await supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'cashback');

      const { count: boostCount } = await supabase
        .from('boosts')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const { count: pendingCount } = await supabase
        .from('vendors')
        .select('*', { count: 'exact', head: true })
        .eq('is_verified', false)
        .eq('verification_fee_paid', true);

      setStats({
        totalUsers: userCount || 0,
        totalVendors: vendorCount || 0,
        totalRevenue: revenueData?.reduce((sum, t) => sum + t.amount, 0) || 0,
        totalCashback: cashbackData?.reduce((sum, t) => sum + t.amount, 0) || 0,
        activeBoosts: boostCount || 0,
        pendingVerifications: pendingCount || 0,
      });

      // Get recent transactions
      const { data: txData } = await supabase
        .from('transactions')
        .select(`
          *,
          user:users(name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      setTransactions(txData || []);

      // Get pending vendors
      const { data: pendingVendorsData } = await supabase
        .from('vendors')
        .select(`
          *,
          user:users(name, email)
        `)
        .eq('is_verified', false)
        .eq('verification_fee_paid', true)
        .order('created_at', { ascending: false });

      setPendingVendors(pendingVendorsData || []);

      // Get recent users
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentUsers(usersData || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  const verifyVendor = async (vendorId: string) => {
    try {
      await supabase
        .from('vendors')
        .update({
          is_verified: true,
          verification_paid_at: new Date().toISOString(),
        })
        .eq('id', vendorId);

      // Create notification
      const { data: vendor } = await supabase
        .from('vendors')
        .select('user_id')
        .eq('id', vendorId)
        .single();

      if (vendor) {
        await supabase.from('notifications').insert({
          user_id: vendor.user_id,
          type: 'vendor_verified',
          title: 'Vendor Verified!',
          message: 'Your vendor account has been verified. You can now enjoy all vendor benefits!',
        });
      }

      loadDashboardData();
    } catch (error) {
      console.error('Error verifying vendor:', error);
    }
  };

  if (!isAuthenticated || !isAdmin) return null;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-8 w-8 text-emerald-600" />
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          </div>
          <Button variant="outline" onClick={loadDashboardData}>
            Refresh
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <StatCard
            title="Total Users"
            value={stats.totalUsers.toString()}
            icon={<Users className="h-5 w-5" />}
            color="bg-blue-500"
          />
          <StatCard
            title="Vendors"
            value={stats.totalVendors.toString()}
            icon={<Store className="h-5 w-5" />}
            color="bg-purple-500"
          />
          <StatCard
            title="Revenue"
            value={formatCurrency(stats.totalRevenue)}
            icon={<CreditCard className="h-5 w-5" />}
            color="bg-green-500"
          />
          <StatCard
            title="Cashback"
            value={formatCurrency(stats.totalCashback)}
            icon={<Gift className="h-5 w-5" />}
            color="bg-emerald-500"
          />
          <StatCard
            title="Active Boosts"
            value={stats.activeBoosts.toString()}
            icon={<Zap className="h-5 w-5" />}
            color="bg-amber-500"
          />
          <StatCard
            title="Pending Verifications"
            value={stats.pendingVerifications.toString()}
            icon={<Clock className="h-5 w-5" />}
            color="bg-red-500"
          />
        </div>

        <Tabs defaultValue="transactions">
          <TabsList className="mb-4">
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="vendors">Pending Vendors</TabsTrigger>
            <TabsTrigger value="users">Recent Users</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>{tx.user?.name || 'Unknown'}</TableCell>
                        <TableCell className="capitalize">{tx.type.replace(/_/g, ' ')}</TableCell>
                        <TableCell className={tx.type === 'cashback' || tx.type === 'referral_reward' ? 'text-green-600' : ''}>
                          {tx.type === 'cashback' || tx.type === 'referral_reward' ? '+' : '-'}
                          {formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tx.status === 'success' ? 'default' : 'secondary'}>
                            {tx.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(tx.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendors">
            <Card>
              <CardHeader>
                <CardTitle>Pending Vendor Verifications</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingVendors.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No pending verifications
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business Name</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Applied</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingVendors.map((vendor) => (
                        <TableRow key={vendor.id}>
                          <TableCell className="font-medium">{vendor.business_name}</TableCell>
                          <TableCell>{vendor.user?.name}</TableCell>
                          <TableCell>{vendor.category}</TableCell>
                          <TableCell>{formatDate(vendor.created_at)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => verifyVendor(vendor.id)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Verify
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Recent Users</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Wallet</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? 'destructive' : 'default'}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(user.created_at)}</TableCell>
                        <TableCell>{formatCurrency(user.wallet_balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function StatCard({ 
  title, 
  value, 
  icon, 
  color 
}: { 
  title: string; 
  value: string; 
  icon: React.ReactNode; 
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-xl font-bold mt-1">{value}</p>
          </div>
          <div className={`${color} text-white p-2 rounded-lg`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
