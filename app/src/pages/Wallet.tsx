import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Gift, 
  TrendingUp,
  CreditCard,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Layout } from '@/components/Layout';
import { useAuth, useWallet } from '@/hooks';
import { formatCurrency, formatDate } from '@/lib/supabase';
import type { Transaction } from '@/types/database';

export function WalletPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { getTransactions, getWalletBalance } = useWallet();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [walletData, setWalletData] = useState({
    wallet_balance: 0,
    total_spent: 0,
    total_cashback_earned: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    loadWalletData();
  }, [isAuthenticated, authLoading]);

  const loadWalletData = async () => {
    setLoading(true);
    const [{ data: txData }, { data: balanceData }] = await Promise.all([
      getTransactions(),
      getWalletBalance(),
    ]);

    if (txData) setTransactions(txData);
    if (balanceData) setWalletData(balanceData);
    setLoading(false);
  };

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'cashback':
      case 'referral_reward':
        return <Gift className="h-5 w-5 text-emerald-600" />;
      case 'wallet_topup':
        return <ArrowDownLeft className="h-5 w-5 text-green-600" />;
      case 'refund':
        return <RefreshCw className="h-5 w-5 text-blue-600" />;
      default:
        return <ArrowUpRight className="h-5 w-5 text-red-600" />;
    }
  };

  const getTransactionLabel = (type: Transaction['type']) => {
    const labels: Record<string, string> = {
      listing_fee: 'Listing Fee',
      boost_featured: 'Featured Boost',
      boost_urgent: 'Urgent Boost',
      boost_premium: 'Premium Boost',
      vendor_verification: 'Vendor Verification',
      vendor_featured: 'Featured Vendor',
      wallet_topup: 'Wallet Top-up',
      cashback: 'Cashback',
      referral_reward: 'Referral Reward',
      wallet_payment: 'Wallet Payment',
      refund: 'Refund',
    };
    return labels[type] || type;
  };

  const getTransactionAmount = (tx: Transaction) => {
    const isCredit = ['cashback', 'referral_reward', 'wallet_topup', 'refund'].includes(tx.type);
    return {
      sign: isCredit ? '+' : '-',
      color: isCredit ? 'text-green-600' : 'text-red-600',
    };
  };

  const incomingTransactions = transactions.filter(tx => 
    ['cashback', 'referral_reward', 'wallet_topup', 'refund'].includes(tx.type)
  );

  const outgoingTransactions = transactions.filter(tx => 
    !['cashback', 'referral_reward', 'wallet_topup', 'refund'].includes(tx.type)
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Wallet</h1>

        {/* Balance Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm">Available Balance</p>
                  <p className="text-3xl font-bold mt-1">
                    {formatCurrency(walletData.wallet_balance)}
                  </p>
                </div>
                <Wallet className="h-10 w-10 text-emerald-200" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Total Spent</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatCurrency(walletData.total_spent)}
                  </p>
                </div>
                <CreditCard className="h-10 w-10 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Cashback Earned</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">
                    {formatCurrency(walletData.total_cashback_earned)}
                  </p>
                </div>
                <Gift className="h-10 w-10 text-emerald-400" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                5% cashback on every payment
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Info Banner */}
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">How Cashback Works</p>
                <p className="text-sm text-blue-700">
                  You earn 5% cashback on every payment you make. Cashback is added to your 
                  wallet instantly and can be used for boosts, listings, and other platform features. 
                  Cashback cannot be withdrawn.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Transaction History</CardTitle>
              <Button variant="outline" size="sm" onClick={loadWalletData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList className="mb-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="incoming">Incoming</TabsTrigger>
                <TabsTrigger value="outgoing">Outgoing</TabsTrigger>
              </TabsList>

              <TabsContent value="all">
                <TransactionList 
                  transactions={transactions} 
                  getTransactionIcon={getTransactionIcon}
                  getTransactionLabel={getTransactionLabel}
                  getTransactionAmount={getTransactionAmount}
                  loading={loading}
                />
              </TabsContent>

              <TabsContent value="incoming">
                <TransactionList 
                  transactions={incomingTransactions}
                  getTransactionIcon={getTransactionIcon}
                  getTransactionLabel={getTransactionLabel}
                  getTransactionAmount={getTransactionAmount}
                  loading={loading}
                />
              </TabsContent>

              <TabsContent value="outgoing">
                <TransactionList 
                  transactions={outgoingTransactions}
                  getTransactionIcon={getTransactionIcon}
                  getTransactionLabel={getTransactionLabel}
                  getTransactionAmount={getTransactionAmount}
                  loading={loading}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

interface TransactionListProps {
  transactions: Transaction[];
  getTransactionIcon: (type: Transaction['type']) => React.ReactNode;
  getTransactionLabel: (type: Transaction['type']) => string;
  getTransactionAmount: (tx: Transaction) => { sign: string; color: string };
  loading: boolean;
}

function TransactionList({ 
  transactions, 
  getTransactionIcon, 
  getTransactionLabel, 
  getTransactionAmount,
  loading 
}: TransactionListProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/4"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No transactions yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx) => {
        const { sign, color } = getTransactionAmount(tx);
        return (
          <div 
            key={tx.id} 
            className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
              {getTransactionIcon(tx.type)}
            </div>
            <div className="flex-1">
              <p className="font-medium">{getTransactionLabel(tx.type)}</p>
              <p className="text-sm text-gray-500">{formatDate(tx.created_at)}</p>
            </div>
            <div className="text-right">
              <p className={`font-bold ${color}`}>
                {sign}{formatCurrency(tx.amount)}
              </p>
              <Badge 
                variant={tx.status === 'success' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {tx.status}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}
