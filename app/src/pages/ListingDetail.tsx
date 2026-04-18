import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Share2, 
  Flag, 
  MessageCircle, 
  Zap, 
  Clock, 
  Shield,
  MapPin,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Layout } from '@/components/Layout';
import { useListings, useAuth, useChat, usePaystack } from '@/hooks';
import { formatCurrency, formatDate, PRICING } from '@/lib/supabase';
import type { ListingWithUser } from '@/hooks/useListings';

export function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getListing, boostListing } = useListings();
  const { user, isAuthenticated } = useAuth();
  const { startChat } = useChat();
  const { payForBoost } = usePaystack();
  
  const [listing, setListing] = useState<ListingWithUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [boostDialogOpen, setBoostDialogOpen] = useState(false);
  const [boosting, setBoosting] = useState(false);

  useEffect(() => {
    if (id) {
      loadListing();
    }
  }, [id]);

  const loadListing = async () => {
    setLoading(true);
    const { data } = await getListing(id!);
    if (data) {
      setListing(data);
    }
    setLoading(false);
  };

  const handleContactSeller = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (listing?.user_id === user?.id) {
      return; // Can't contact yourself
    }

    const { data } = await startChat(listing!.id, listing!.user_id);
    if (data) {
      navigate(`/messages?chat=${data.id}`);
    }
  };

  const handleBoost = async (boostType: 'featured' | 'urgent' | 'premium') => {
    if (!isAuthenticated || !listing) return;

    setBoosting(true);
    await payForBoost({
      email: user!.email,
      boostType,
      onSuccess: async () => {
        // Apply boost after payment
        await boostListing(listing.id, boostType);
        setBoostDialogOpen(false);
        loadListing();
        setBoosting(false);
      },
      onCancel: () => {
        setBoosting(false);
      },
    });
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: listing?.title,
        text: `Check out this listing on HikmahHub: ${listing?.title}`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-96 bg-gray-200 rounded-lg mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!listing) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Listing not found</h1>
          <p className="text-gray-600 mt-2">This listing may have been removed or expired</p>
          <Button 
            className="mt-4 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => navigate('/marketplace')}
          >
            Browse Marketplace
          </Button>
        </div>
      </Layout>
    );
  }

  const isOwner = user?.id === listing.user_id;
  const boostOptions = [
    { type: 'featured' as const, name: 'Featured', price: PRICING.BOOST.FEATURED, hours: 48, color: 'bg-amber-500' },
    { type: 'urgent' as const, name: 'Urgent', price: PRICING.BOOST.URGENT, hours: 24, color: 'bg-red-500' },
    { type: 'premium' as const, name: 'Premium', price: PRICING.BOOST.PREMIUM, hours: 72, color: 'bg-purple-500' },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back Button */}
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5 mr-1" />
          Back
        </button>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div>
            <div className="aspect-square bg-gray-200 rounded-lg overflow-hidden relative">
              {listing.images?.[currentImageIndex] ? (
                <img 
                  src={listing.images[currentImageIndex]} 
                  alt={listing.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  No Image
                </div>
              )}
              {listing.is_boosted && (
                <Badge className="absolute top-4 left-4 bg-amber-500 text-white">
                  <Zap className="h-4 w-4 mr-1" />
                  Boosted
                </Badge>
              )}
            </div>
            
            {/* Thumbnails */}
            {listing.images && listing.images.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto">
                {listing.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 ${
                      currentImageIndex === index ? 'border-emerald-600' : 'border-transparent'
                    }`}
                  >
                    <img src={image} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Listing Details */}
          <div>
            <div className="flex items-start justify-between">
              <div>
                <Badge className="mb-2 capitalize">{listing.category}</Badge>
                <h1 className="text-2xl font-bold text-gray-900">{listing.title}</h1>
                <p className="text-3xl font-bold text-emerald-600 mt-2">
                  {formatCurrency(listing.price)}
                </p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleShare}
                  className="p-2 rounded-full bg-gray-100 hover:bg-gray-200"
                >
                  <Share2 className="h-5 w-5" />
                </button>
                <button className="p-2 rounded-full bg-gray-100 hover:bg-gray-200">
                  <Flag className="h-5 w-5" />
                </button>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Seller Info */}
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                      {listing.user?.profile_image ? (
                        <img 
                          src={listing.user.profile_image} 
                          alt={listing.user.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-bold text-emerald-600">
                          {listing.user?.name?.[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{listing.user?.name}</p>
                      <p className="text-sm text-gray-500">{listing.user?.department}</p>
                    </div>
                  </div>
                  <Link to={`/profile/${listing.user_id}`}>
                    <Button variant="outline" size="sm">View Profile</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{listing.description}</p>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {listing.condition && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Shield className="h-5 w-5" />
                  <span>Condition: <span className="capitalize">{listing.condition}</span></span>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="h-5 w-5" />
                <span>{listing.user?.campus}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="h-5 w-5" />
                <span>Posted {formatDate(listing.created_at)}</span>
              </div>
              {listing.is_boosted && listing.boost_expires_at && (
                <div className="flex items-center gap-2 text-amber-600">
                  <Clock className="h-5 w-5" />
                  <span>Boost expires {formatDate(listing.boost_expires_at)}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {!isOwner ? (
                <Button 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  size="lg"
                  onClick={handleContactSeller}
                >
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Contact Seller
                </Button>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    size="lg"
                    onClick={() => navigate(`/edit-listing/${listing.id}`)}
                  >
                    Edit Listing
                  </Button>
                  {!listing.is_boosted && (
                    <Button 
                      className="flex-1 bg-amber-500 hover:bg-amber-600"
                      size="lg"
                      onClick={() => setBoostDialogOpen(true)}
                    >
                      <Zap className="h-5 w-5 mr-2" />
                      Boost
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Boost Dialog */}
      <Dialog open={boostDialogOpen} onOpenChange={setBoostDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Boost Your Listing</DialogTitle>
            <DialogDescription>
              Get more visibility for your listing with our boost options
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {boostOptions.map((option) => (
              <button
                key={option.type}
                onClick={() => handleBoost(option.type)}
                disabled={boosting}
                className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-emerald-500 transition-colors text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${option.color} flex items-center justify-center`}>
                      <Zap className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold">{option.name} Boost</p>
                      <p className="text-sm text-gray-500">{option.hours} hours visibility</p>
                    </div>
                  </div>
                  <p className="font-bold text-emerald-600">{formatCurrency(option.price)}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
