import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, 
  Camera,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Layout } from '@/components/Layout';
import { useAuth, useListings, usePaystack } from '@/hooks';
import { PRICING, formatCurrency } from '@/lib/supabase';

const categories = [
  'Electronics',
  'Fashion',
  'Books',
  'Services',
  'Food',
  'Accommodation',
  'Others',
];

const conditions = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'used', label: 'Used' },
];

export function CreateListing() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { createListing } = useListings();
  const { payForListing } = usePaystack();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: '',
  });
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [listingFee, setListingFee] = useState(0);

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Convert to base64 for preview (in production, upload to Supabase Storage)
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.title || !formData.description || !formData.price || !formData.category) {
      setError('Please fill in all required fields');
      return;
    }

    if (images.length === 0) {
      setError('Please add at least one image');
      return;
    }

    // Calculate listing fee
    const isFirstListing = !user?.free_listing_used;
    const fee = isFirstListing ? 0 : PRICING.LISTING.SUBSEQUENT;
    setListingFee(fee);

    if (fee > 0) {
      setPaymentDialogOpen(true);
    } else {
      // First listing is free
      await createListingWithPayment();
    }
  };

  const createListingWithPayment = async () => {
    setLoading(true);
    setPaymentDialogOpen(false);

    const { data, error } = await createListing({
      title: formData.title,
      description: formData.description,
      price: parseFloat(formData.price),
      category: formData.category.toLowerCase(),
      condition: formData.condition || undefined,
      images,
    });

    if (error) {
      setError(error.message || 'Failed to create listing');
      setLoading(false);
      return;
    }

    navigate(`/listing/${data?.id}`);
  };

  const handlePayment = async () => {
    setLoading(true);
    
    const { error } = await payForListing({
      email: user!.email,
      isFirstListing: false,
      onSuccess: () => {
        createListingWithPayment();
      },
      onCancel: () => {
        setLoading(false);
        setPaymentDialogOpen(false);
      },
    });

    if (error) {
      setError('Payment failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Listing</h1>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Listing Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="What are you selling?"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  maxLength={100}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your item in detail..."
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={4}
                />
              </div>

              {/* Price */}
              <div className="space-y-2">
                <Label htmlFor="price">Price (₦) *</Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="0.00"
                  value={formData.price}
                  onChange={(e) => handleChange('price', e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => handleChange('category', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat.toLowerCase()}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Condition */}
              <div className="space-y-2">
                <Label htmlFor="condition">Condition</Label>
                <Select 
                  value={formData.condition} 
                  onValueChange={(value) => handleChange('condition', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {conditions.map((cond) => (
                      <SelectItem key={cond.value} value={cond.value}>
                        {cond.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Images */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-4 mb-4">
                {images.map((image, index) => (
                  <div key={index} className="relative aspect-square">
                    <img 
                      src={image} 
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                
                {images.length < 5 && (
                  <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 transition-colors">
                    <Camera className="h-8 w-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">Add Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                )}
              </div>
              <p className="text-sm text-gray-500">
                Add up to 5 photos. First photo will be the cover image.
              </p>
            </CardContent>
          </Card>

          {/* Listing Fee Info */}
          <Card className="mb-6 bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">Listing Fee</p>
                  <p className="text-sm text-blue-700">
                    {user?.free_listing_used ? (
                      <>Subsequent listings cost <strong>{formatCurrency(PRICING.LISTING.SUBSEQUENT)}</strong></>
                    ) : (
                      <><strong>First listing is FREE!</strong> Subsequent listings will cost {formatCurrency(PRICING.LISTING.SUBSEQUENT)}</>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-4">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Listing'}
            </Button>
          </div>
        </form>
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay Listing Fee</DialogTitle>
            <DialogDescription>
              This is not your first listing. Please pay the listing fee to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-600">
                {formatCurrency(listingFee)}
              </p>
              <p className="text-gray-500 mt-2">Listing Fee</p>
            </div>
            <div className="mt-4 p-4 bg-emerald-50 rounded-lg">
              <p className="text-sm text-emerald-700">
                <strong>Good to know:</strong> You'll earn 5% cashback (₦{listingFee * 0.05}) 
                after successful payment!
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => setPaymentDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={handlePayment}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Pay Now'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
