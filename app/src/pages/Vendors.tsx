import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Store, 
  Search, 
  Shield, 
  Star, 
  MapPin,
  ArrowRight,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Layout } from '@/components/Layout';
import { useAuth, useVendors } from '@/hooks';
import type { VendorWithUser } from '@/hooks/useVendors';

const categories = [
  'All',
  'Electronics',
  'Fashion',
  'Food',
  'Services',
  'Books',
  'Others',
];

export function Vendors() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { getVendors, getVendorByUserId } = useVendors();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [myVendorProfile, setMyVendorProfile] = useState<VendorWithUser | null>(null);
  const [featuredVendors, setFeaturedVendors] = useState<VendorWithUser[]>([]);
  const [allVendors, setAllVendors] = useState<VendorWithUser[]>([]);

  useEffect(() => {
    loadVendors();
    if (isAuthenticated && user?.role === 'vendor') {
      loadMyVendorProfile();
    }
  }, [isAuthenticated, user]);

  const loadVendors = async () => {
    const { data: featured } = await getVendors({ featured: true });
    const { data: all } = await getVendors();
    setFeaturedVendors(featured || []);
    setAllVendors(all || []);
  };

  const loadMyVendorProfile = async () => {
    if (user) {
      const { data } = await getVendorByUserId(user.id);
      setMyVendorProfile(data);
    }
  };

  const filteredVendors = allVendors.filter(vendor => {
    const matchesSearch = vendor.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         vendor.business_description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || vendor.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
                if (user?.role === 'vendor') {
                  navigate('/vendor-dashboard');
                } else {
                  navigate('/become-vendor');
                }
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

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search vendors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* My Vendor Profile */}
        {myVendorProfile && (
          <Card className="mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center">
                    {myVendorProfile.business_logo ? (
                      <img 
                        src={myVendorProfile.business_logo} 
                        alt={myVendorProfile.business_name}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <Store className="h-8 w-8 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg">{myVendorProfile.business_name}</h3>
                      {myVendorProfile.is_verified && (
                        <Badge className="bg-blue-500">
                          <Shield className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <p className="text-gray-600">{myVendorProfile.category}</p>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-amber-500" />
                        {myVendorProfile.rating || '0.0'}
                      </span>
                      <span>({myVendorProfile.reviews_count || 0} reviews)</span>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => navigate('/vendor-dashboard')}
                >
                  Manage
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="featured">
          <TabsList className="mb-4">
            <TabsTrigger value="featured">Featured Vendors</TabsTrigger>
            <TabsTrigger value="all">All Vendors</TabsTrigger>
          </TabsList>

          <TabsContent value="featured">
            {featuredVendors.length > 0 ? (
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

            {filteredVendors.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVendors.map((vendor) => (
                  <VendorCard key={vendor.id} vendor={vendor} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-lg font-medium text-gray-900">No vendors found</h3>
                <p className="text-gray-500">Try adjusting your search</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function VendorCard({ vendor }: { vendor: VendorWithUser }) {
  return (
    <Link to={`/vendor/${vendor.id}`}>
      <Card className="hover:shadow-lg transition-shadow h-full">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              {vendor.business_logo ? (
                <img 
                  src={vendor.business_logo} 
                  alt={vendor.business_name}
                  className="w-16 h-16 rounded-full object-cover"
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
              <p className="text-sm text-emerald-600">{vendor.category}</p>
              <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                {vendor.business_description}
              </p>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-amber-500" />
                  {vendor.rating || '0.0'}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {vendor.business_address || 'Campus'}
                </span>
              </div>
            </div>
          </div>
          {vendor.is_featured && (
            <Badge className="mt-4 bg-amber-500">
              Featured Vendor
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
