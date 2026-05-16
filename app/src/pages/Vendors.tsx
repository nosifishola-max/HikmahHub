import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Store,
  Search,
  Shield,
  Star,
  MapPin,
  ArrowRight,
  Plus,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Layout } from '@/components/Layout';
import { useAuth, useVendors } from '@/hooks';
import type { VendorWithUser } from '@/hooks/useVendors';
import { Skeleton } from '@/components/ui/skeleton';

const categories = [
  'All',
  'Electronics',
  'Fashion',
  'Food',
  'Services',
  'Books',
  'Others',
];

function VendorCard({ vendor }: { vendor: VendorWithUser }) {
  return (
    <Link to={`/vendor/${vendor.id}`}>
      <Card className="hover:shadow-lg transition-shadow h-full">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {vendor.business_logo ? (
                <img
                  src={vendor.business_logo}
                  alt={vendor.business_name}
                  className="w-16 h-16 object-cover"
                />
              ) : (
                <Store className="h-8 w-8 text-gray-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold truncate">{vendor.business_name}</h3>
                {vendor.is_verified && (
                  <Shield className="h-4 w-4 text-blue-500 flex-shrink-0" />
                )}
              </div>

              <p className="text-sm text-emerald-700 mt-1">{vendor.category}</p>
              <p className="text-sm text-gray-500 line-clamp-2 mt-2">
                {vendor.business_description || 'No description provided.'}
              </p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-4 w-4 text-amber-500" />
                  {vendor.rating ?? '0.0'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {vendor.business_address || 'Campus'}
                </span>
              </div>
            </div>
          </div>

          {vendor.is_featured && (
            <Badge className="mt-4 bg-amber-500 hover:bg-amber-500">Featured</Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function VendorCardSkeleton({ variant }: { variant: 'compact' | 'default' }) {
  return (
    <Card className="h-full">
      <CardContent className={variant === 'compact' ? 'p-4' : 'p-6'}>
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden">
            <Skeleton className="w-full h-full" />
          </div>
          <div className="flex-1 min-w-0">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-24 mt-3" />
            <Skeleton className="h-3 w-full mt-2" />
            <Skeleton className="h-3 w-5/6 mt-1" />
            <div className="flex gap-4 mt-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function Vendors() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const { getVendors, getVendorByUserId } = useVendors();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [myVendorProfile, setMyVendorProfile] = useState<VendorWithUser | null>(null);
  const [featuredVendors, setFeaturedVendors] = useState<VendorWithUser[]>([]);
  const [allVendors, setAllVendors] = useState<VendorWithUser[]>([]);

  const [loadingVendors, setLoadingVendors] = useState(false);
  const [loadingMyVendor, setLoadingMyVendor] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredVendors = useMemo(() => {
    const sq = searchQuery.trim().toLowerCase();
    return allVendors.filter((vendor) => {
      const matchesSearch =
        !sq ||
        vendor.business_name.toLowerCase().includes(sq) ||
        (vendor.business_description || '').toLowerCase().includes(sq);

      const matchesCategory =
        selectedCategory === 'All' || vendor.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [allVendors, searchQuery, selectedCategory]);

  useEffect(() => {
    loadVendors();
    if (isAuthenticated && user?.role === 'vendor') {
      loadMyVendorProfile();
    } else {
      setMyVendorProfile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

  const loadVendors = async () => {
    setLoadingVendors(true);
    setError(null);

    try {
      const [featuredRes, allRes] = await Promise.all([
        getVendors({ featured: true }),
        getVendors(),
      ]);

      setFeaturedVendors(featuredRes?.data || []);
      setAllVendors(allRes?.data || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load vendors');
    } finally {
      setLoadingVendors(false);
    }
  };

  const loadMyVendorProfile = async () => {
    if (!user) return;

    setLoadingMyVendor(true);
    try {
      const { data } = await getVendorByUserId(user.id);
      setMyVendorProfile(data);
    } finally {
      setLoadingMyVendor(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
            <p className="text-gray-600">Discover verified sellers on campus</p>
          </div>

          {isAuthenticated && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                if (user?.role === 'vendor') navigate('/vendor-dashboard');
                else navigate('/become-vendor');
              }}
            >
              {user?.role === 'vendor' ? (
                <>
                  <Store className="h-4 w-4 mr-2" />
                  My Vendor Dashboard
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Become a Vendor
                </>
              )}
            </Button>
          )}
        </div>

        {/* Search + Quick Reset */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {(searchQuery.trim().length > 0 || selectedCategory !== 'All') && (
              <Button
                type="button"
                variant="outline"
                className="border-gray-200 hover:bg-gray-50"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* My Vendor Profile */}
        {isAuthenticated && user?.role === 'vendor' && (
          <div className="mb-6">
            {loadingMyVendor ? (
              <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-16 h-16 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-4 w-1/3 mt-2" />
                      <div className="flex gap-4 mt-4">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : myVendorProfile ? (
              <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center overflow-hidden">
                        {myVendorProfile.business_logo ? (
                          <img
                            src={myVendorProfile.business_logo}
                            alt={myVendorProfile.business_name}
                            className="w-16 h-16 object-cover"
                          />
                        ) : (
                          <Store className="h-8 w-8 text-emerald-600" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg truncate">
                            {myVendorProfile.business_name}
                          </h3>
                          {myVendorProfile.is_verified && (
                            <Badge className="bg-blue-500">
                              <Shield className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                        </div>
                        <p className="text-gray-600 mt-1 truncate">
                          {myVendorProfile.category}
                        </p>

                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-4 w-4 text-amber-500" />
                            {myVendorProfile.rating || '0.0'}
                          </span>
                          <span>
                            ({myVendorProfile.reviews_count || 0} reviews)
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button variant="outline" onClick={() => navigate('/vendor-dashboard')}>
                      Manage
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}

        {/* Errors */}
        {error && (
          <div className="mb-6">
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4 text-red-700">
                {error}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="featured">
          <TabsList className="mb-4">
            <TabsTrigger value="featured">Featured Vendors</TabsTrigger>
            <TabsTrigger value="all">All Vendors</TabsTrigger>
          </TabsList>

          <TabsContent value="featured">
            {loadingVendors ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <VendorCardSkeleton key={idx} variant="default" />
                ))}
              </div>
            ) : featuredVendors.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {featuredVendors.map((vendor) => (
                  <VendorCard key={vendor.id} vendor={vendor} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🏪</div>
                <h3 className="text-lg font-medium text-gray-900">No featured vendors</h3>
                <p className="text-gray-500">Check back later for featured vendors</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="all">
            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-4 mb-4">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                    selectedCategory === category
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {loadingVendors ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, idx) => (
                  <VendorCardSkeleton key={idx} variant="default" />
                ))}
              </div>
            ) : filteredVendors.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVendors.map((vendor) => (
                  <VendorCard key={vendor.id} vendor={vendor} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-lg font-medium text-gray-900">No vendors found</h3>
                <p className="text-gray-500">Try adjusting your search or filters.</p>
              </div>
            )}

            {!loadingVendors && (
              <div className="mt-4 text-sm text-gray-600">
                {filteredVendors.length} vendor{filteredVendors.length === 1 ? '' : 's'} found
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
