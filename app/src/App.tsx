import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { 
  Home, 
  Login, 
  Signup, 
  Marketplace, 
  ListingDetail, 
  CreateListing,
  Profile,
  WalletPage,
  Messages,
  Vendors,
  BecomeVendor,
  Notifications,
  AdminDashboard,
} from '@/pages';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/listing/:id" element={<ListingDetail />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/vendor/:id" element={<Vendors />} />

        {/* Protected Routes */}
        <Route path="/create-listing" element={<CreateListing />} />
        <Route path="/edit-listing/:id" element={<CreateListing />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:id" element={<Profile />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/become-vendor" element={<BecomeVendor />} />
        <Route path="/vendor-dashboard" element={<BecomeVendor />} />
        <Route path="/admin" element={<AdminDashboard />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-center" />
    </BrowserRouter>
  );
}

export default App;
