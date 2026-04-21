import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Upload, Info, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Layout } from '@/components/Layout';
import { useAuth, useVendors, usePaystack } from '@/hooks';
import { PRICING, formatCurrency } from '@/lib/supabase';

const categories = [
  'Electronics',
  'Fashion',
  'Food',
  'Services',
  'Books',
  'Others',
];

export function BecomeVendor() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { createVendor } = useVendors();
  const { payForVendorVerification } = usePaystack();

  const [formData, setFormData] = useState({
    business_name: '',
    business_description: '',
    category: '',
    contact_email: '',
    contact_phone: '',
    business_address: '',
  });
  const [logo, setLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.business_name || !formData.category) {
      setError('Please fill in all required fields');
      return;
    }

    setPaymentDialogOpen(true);
  };

  const handlePayment = async () => {
    setLoading(true);

    const { error: paymentError } = await payForVendorVerification({
      email: user!.email,
      onSuccess: async () => {
        await createVendorProfile();
      },
      onCancel: () => {
        setLoading(false);
        setPaymentDialogOpen(false);
      },
    });

    if (paymentError) {
      setError('Payment failed. Please try again.');
      setLoading(false);
    }
  };

  const createVendorProfile = async () => {
    const { error: vendorError } = await createVendor({
      ...formData,
      business_logo: logo || undefined,
    });

    if (vendorError) {
      setError(vendorError.message || 'Failed to create vendor profile');
      setLoading(false);
      setPaymentDialogOpen(false);
      return;
    }

    setLoading(false);
    setPaymentDialogOpen(false);
    setSuccessDialogOpen(true);
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Become a Vendor</h1>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>Business Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                    {logo ? (
                      <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Store className="h-8 w-8 text-gray-400" />
                    )}
                  </div>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                    <Button type="button" variant="outline">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Logo
                    </Button>
                  </label>
                </div>
              </div>

              {/* Business Name */}
              <div className="space-y-2">
                <Label htmlFor="business_name">Business Name *</Label>
                <Input
                  id="business_name"
                  placeholder="Your business name"
                  value={formData.business_name}
                  onChange={(e) => handleChange('business_name', e.target.value)}
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="business_description">Description</Label>
                <Textarea
                  id="business_description"
                  placeholder="Describe your business..."
                  value={formData.business_description}
                  onChange={(e) => handleChange('business_description', e.target.value)}
                  rows={3}
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  placeholder="business@email.com"
                  value={formData.contact_email}
                  onChange={(e) => handleChange('contact_email', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_phone">Contact Phone</Label>
                <Input
                  id="contact_phone"
                  type="tel"
                  placeholder="+234..."
                  value={formData.contact_phone}
                  onChange={(e) => handleChange('contact_phone', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="business_address">Business Address</Label>
                <Input
                  id="business_address"
                  placeholder="Your location on campus"
                  value={formData.business_address}
                  onChange={(e) => handleChange('business_address', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Verification Fee Info */}
          <Card className="mb-6 bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">Vendor Verification Fee</p>
                  <p className="text-sm text-blue-700">
                    One-time verification fee of <strong>{formatCurrency(PRICING.VENDOR.VERIFICATION)}</strong>.
                    This helps us maintain quality and trust on the platform.
                  </p>
                  <ul className="text-sm text-blue-700 mt-2 list-disc list-inside">
                    <li>Verified badge on your profile</li>
                    <li>Higher visibility in search</li>
                    <li>Access to vendor analytics</li>
                    <li>Priority customer support</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

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
              loading={loading}
            >
              Continue to Payment
            </Button>
          </div>
        </form>
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay Verification Fee</DialogTitle>
            <DialogDescription>
              Complete payment to become a verified vendor
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-600">
                {formatCurrency(PRICING.VENDOR.VERIFICATION)}
              </p>
              <p className="text-gray-500 mt-2">One-time Verification Fee</p>
            </div>
            <div className="mt-4 p-4 bg-emerald-50 rounded-lg">
              <p className="text-sm text-emerald-700">
                <strong>Plus:</strong> You'll earn 5% cashback (₦{PRICING.VENDOR.VERIFICATION * 0.05}) 
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
              loading={loading}
            >
              Pay Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-center">Application Submitted!</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <p className="text-gray-600">
              Your vendor application has been submitted successfully. 
              We'll review your application and notify you once approved.
            </p>
          </div>
          <Button 
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            onClick={() => navigate('/vendor-dashboard')}
          >
            Go to Vendor Dashboard
          </Button>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
