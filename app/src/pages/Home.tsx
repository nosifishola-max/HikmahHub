import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, TrendingUp, Zap, Shield, Users, ArrowRight, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layout } from '@/components/Layout';
import { useListings, useVendors, useAuth } from '@/hooks';
import { formatCurrency, formatRelativeTime } from '@/lib/supabase';
import type { ListingWithUser } from '@/hooks/useListings';
import type { VendorWithUser } from '@/hooks/useVendors';
import { Store } from 'lucide-react';

export function Home() {
  const { fetchListings } = useListings();
  const { getVendors } = useVendors();
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [featuredListings, setFeaturedListings] = useState<ListingWithUser[]>([]);
  const [featuredVendors, setFeaturedVendors] = useState<VendorWithUser[]>([]);

  useEffect(() => {
    fetchListings({ boosted: true }).then((result: any) => {
      if (result.data) {
        setFeaturedListings(result.data.slice(0, 6));
      }
    });
    getVendors({ featured: true }).then((result: any) => {
      if (result.data) {
        setFeaturedVendors(result.data.slice(0, 4));
      }
    });
  }, [fetchListings, getVendors]);

  const categories = [
    { name: 'Electronics', icon: '💻', color: 'bg-blue-100' },
    { name: 'Fashion', icon: '👕', color: 'bg-pink-100' },
    { name: 'Books', icon: '📚', color: 'bg-yellow-100' },
    { name: 'Services', icon: '🛠️', color: 'bg-green-100' },
    { name: 'Food', icon: '🍔', color: 'bg-orange-100' },
    { name: 'Accommodation', icon: '🏠', color: 'bg-purple-100' },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/marketplace?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <Layout>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-3xl md:text-5xl font-bold mb-4">
              Buy & Sell on Campus
            </h1>
            <p className="text-lg md:text-xl text-emerald-100 mb-8">
              The trusted marketplace for Al-Hikmah University students. 
              Find great deals, offer services, and connect with verified vendors.
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex gap-2 max-w-xl mx-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search for items, services..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 bg-white text-gray-900"
                />
              </div>
              <Button type="submit" className="h-12 px-6 bg-emerald-900 hover:bg-emerald-950">
                Search
              </Button>
            </form>

            {/* Quick Stats */}
            <div className="flex justify-center gap-8 mt-8 text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span>1000+ Students</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <span>Verified Vendors</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                <span>5% Cashback</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Browse Categories</h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {categories.map((category) => (
              <Link
                key={category.name}
                to={`/marketplace?category=${category.name.toLowerCase()}`}
                className={`${category.color} rounded-xl p-4 text-center hover:shadow-md transition-shadow`}
              >
                <span className="text-3xl mb-2 block">{category.icon}</span>
                <span className="text-sm font-medium text-gray-700">{category.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Listings */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
              <h2 className="text-2xl font-bold text-gray-900">Featured Listings</h2>
            </div>
            <Link 
              to="/marketplace" 
              className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {featuredListings.map((listing) => (
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
                    {listing.is_boosted && (
                      <Badge className="absolute top-2 left-2 bg-amber-500">
                        <Zap className="h-3 w-3 mr-1" />
                        Boosted
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-medium text-gray-900 truncate">{listing.title}</h3>
                    <p className="text-emerald-600 font-bold">{formatCurrency(listing.price)}</p>
                    <p className="text-xs text-gray-500">{formatRelativeTime(listing.created_at)}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Vendors */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Star className="h-6 w-6 text-amber-500" />
              <h2 className="text-2xl font-bold text-gray-900">Featured Vendors</h2>
            </div>
            <Link 
              to="/vendors" 
              className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featuredVendors.map((vendor) => (
              <Link key={vendor.id} to={`/vendor/${vendor.id}`}>
                <Card className="p-4 text-center hover:shadow-lg transition-shadow">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-200 overflow-hidden">
                    {vendor.business_logo ? (
                      <img 
                        src={vendor.business_logo} 
                        alt={vendor.business_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Store className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <h3 className="font-medium text-gray-900">{vendor.business_name}</h3>
                  <p className="text-sm text-gray-500">{vendor.category}</p>
                  {vendor.is_verified && (
                    <Badge variant="secondary" className="mt-2">
                      <Shield className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 bg-emerald-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '1', title: 'Sign Up', desc: 'Create your account with your school email' },
              { step: '2', title: 'List or Browse', desc: 'Post items for sale or find what you need' },
              { step: '3', title: 'Connect', desc: 'Chat with buyers/sellers securely' },
              { step: '4', title: 'Earn Cashback', desc: 'Get 5% back on every payment' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xl font-bold">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900">{item.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!isAuthenticated && (
        <section className="py-12 bg-emerald-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Start?</h2>
            <p className="text-emerald-100 mb-6 max-w-xl mx-auto">
              Join thousands of Al-Hikmah University students buying and selling on campus.
            </p>
            <div className="flex justify-center gap-4">
              <Button 
                size="lg" 
                className="bg-white text-emerald-600 hover:bg-gray-100"
                onClick={() => window.location.href = '/signup'}
              >
                Get Started
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white text-white hover:bg-emerald-700"
                onClick={() => window.location.href = '/marketplace'}
              >
                Browse Marketplace
              </Button>
            </div>
          </div>
        </section>
      )}
    </Layout>
  );
}
