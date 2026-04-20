import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  GraduationCap, 
  Calendar,
  Edit2,
  Store,
  Shield,
  Copy,
  Share2,
  Wallet,
  Gift
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Layout } from '@/components/Layout';
import { useAuth, useListings, useVendors } from '@/hooks';
import { formatCurrency, generateReferralLink } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import type { ListingWithUser } from '@/hooks/useListings';

export function Profile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser, isAuthenticated, loading: authLoading } = useAuth();
  const { fetchListings } = useListings();
  const { getVendorByUserId } = useVendors();
  
  const [user, setUser] = useState(currentUser);
  const [userListings, setUserListings] = useState<ListingWithUser[]>([]);
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(!id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    // Handle authentication redirect
    if (!isAuthenticated && !id) {
      navigate('/login');
      return;
    }

    if (id) {
      // Viewing another user's profile
      loadUserProfile(id);
    } else if (currentUser) {
      // Viewing own profile
      setUser(currentUser);
      setIsOwnProfile(true);
      loadUserData(currentUser.id);
    }
  }, [id, currentUser, isAuthenticated, authLoading, navigate]);

  const loadUserProfile = async (userId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Use Supabase client to fetch user profile
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('Error fetching user profile:', fetchError);
        setError('Failed to load user profile');
        return;
      }
      
      if (data) {
        setUser(data as any);
        setIsOwnProfile(currentUser?.id === userId);
        await loadUserData(userId);
      }
    } catch (err: any) {
      console.error('Error in loadUserProfile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const loadUserData = async (userId: string) => {
    try {
      // Load user's listings
      const result: any = await fetchListings({ userId });
      setUserListings(result.data || []);

      // Load vendor profile if applicable
      const { data: vendorData } = await getVendorByUserId(userId);
      setVendorProfile(vendorData);
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  };

  const copyReferralCode = () => {
    if (user?.referral_code) {
      const link = generateReferralLink(user.referral_code);
      navigator.clipboard.writeText(link);
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 2000);
    }
  };

  if (error) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-8 text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <p className="font-medium">{error}</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Show loading while auth is being checked
  if (authLoading || (loading && !user)) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-8 text-center">
          <p className="text-gray-500">Loading profile...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Profile Header */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Avatar */}
              <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                {user.profile_image ? (
                  <img 
                    src={user.profile_image} 
                    alt={user.name}
                    className="w-24 h-24 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-12 w-12 text-emerald-600" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <h1 className="text-2xl font-bold">{user.name}</h1>
                  {user.role === 'vendor' && (
                    <Badge className="bg-emerald-600">
                      <Store className="h-3 w-3 mr-1" />
                      Vendor
                    </Badge>
                  )}
                  {user.verification_status === 'verified' && (
                    <Badge className="bg-blue-500">
                      <Shield className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
                
                <div className="mt-2 space-y-1 text-gray-600">
                  {user.department && (
                    <div className="flex items-center justify-center md:justify-start gap-2">
                      <GraduationCap className="h-4 w-4" />
                      <span>{user.department} {user.level && `- ${user.level}`}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{user.campus}</span>
                  </div>
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <Mail className="h-4 w-4" />
                    <span>{user.email}</span>
                  </div>
                  {user.phone && (
                    <div className="flex items-center justify-center md:justify-start gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{user.phone}</span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex justify-center md:justify-start gap-6 mt-4">
                  <div className="text-center">
                    <p className="font-bold text-lg">{userListings.length}</p>
                    <p className="text-sm text-gray-500">Listings</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-lg">{formatCurrency(user.total_spent || 0)}</p>
                    <p className="text-sm text-gray-500">Total Spent</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-lg text-emerald-600">
                      {formatCurrency(user.total_cashback_earned || 0)}
                    </p>
                    <p className="text-sm text-gray-500">Cashback Earned</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {isOwnProfile && (
                <div className="flex flex-col gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/edit-profile')}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                  <Button 
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => navigate('/wallet')}
                  >
                    <Wallet className="h-4 w-4 mr-2" />
                    Wallet
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Referral Section (Own Profile Only) */}
        {isOwnProfile && user.referral_code && (
          <Card className="mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <Gift className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold text-emerald-900">Invite & Earn ₦500</h3>
              </div>
              <p className="text-sm text-emerald-700 mb-4">
                Share your referral link with friends. You'll both get ₦500 when they make their first payment!
              </p>
              <div className="flex gap-2">
                <div className="flex-1 bg-white rounded-lg px-4 py-2 text-sm text-gray-600 border">
                  {user.referral_code ? generateReferralLink(user.referral_code) : ''}
                </div>
                <Button 
                  variant="outline" 
                  onClick={copyReferralCode}
                  className={referralCopied ? 'bg-emerald-100 border-emerald-300' : ''}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {referralCopied ? 'Copied!' : 'Copy'}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    if (navigator.share && user.referral_code) {
                      navigator.share({
                        title: 'Join me on HikmahHub',
                        text: `Sign up with my referral code and get ₦500!`,
                        url: generateReferralLink(user.referral_code),
                      });
                    }
                  }}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4 flex gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Total Referrals:</span>{' '}
                  <span className="font-medium">{user.referral_earnings ? Math.floor(user.referral_earnings / 500) : 0}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total Earned:</span>{' '}
                  <span className="font-medium text-emerald-600">{formatCurrency(user.referral_earnings || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="listings">
          <TabsList className="mb-4">
            <TabsTrigger value="listings">Listings</TabsTrigger>
            {vendorProfile && <TabsTrigger value="vendor">Vendor Profile</TabsTrigger>}
            {isOwnProfile && <TabsTrigger value="activity">Activity</TabsTrigger>}
          </TabsList>

          <TabsContent value="listings">
            {userListings.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {userListings.map((listing) => (
                  <Link key={listing.id} to={`/listing/${listing.id}`}>
                    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="aspect-square bg-gray-200 relative">
                        {listing.images?.[0] ? (
                          <img 
                            src={listing.images[0]} 
                            alt={listing.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            No Image
                          </div>
                        )}
                      </div>
                      <CardContent className="p-3">
                        <h3 className="font-medium text-gray-900 truncate">{listing.title}</h3>
                        <p className="text-emerald-600 font-bold">{formatCurrency(listing.price)}</p>
                        <Badge 
                          variant={listing.status === 'active' ? 'default' : 'secondary'}
                          className="mt-1 text-xs"
                        >
                          {listing.status}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📦</div>
                <h3 className="text-lg font-medium text-gray-900">No listings yet</h3>
                {isOwnProfile && (
                  <Button 
                    className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => navigate('/create-listing')}
                  >
                    Create Your First Listing
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          {vendorProfile && (
            <TabsContent value="vendor">
              <Card>
                <CardHeader>
                  <CardTitle>{vendorProfile.business_name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{vendorProfile.business_description}</p>
                  <div className="mt-4 space-y-2">
                    <p><span className="font-medium">Category:</span> {vendorProfile.category}</p>
                    <p><span className="font-medium">Contact:</span> {vendorProfile.contact_email || vendorProfile.contact_phone}</p>
                    {vendorProfile.business_address && (
                      <p><span className="font-medium">Address:</span> {vendorProfile.business_address}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isOwnProfile && (
            <TabsContent value="activity">
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">Member Since</p>
                        <p className="text-sm text-gray-500">
                          {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">Wallet Balance</p>
                        <p className="text-sm text-emerald-600 font-bold">
                          {formatCurrency(user.wallet_balance || 0)}
                        </p>
                      </div>
                      <Wallet className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}
