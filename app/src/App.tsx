import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Home, Login, Signup, Marketplace, ListingDetail, CreateListing, Profile, WalletPage, Messages, Vendors, BecomeVendor, Notifications, AdminDashboard } from '@/pages';
import { AuthCallback } from '@/pages/AuthCallback';
import TodoApp from './TodoApp';

import CustomerDashboardOverview from '@/pages/dashboard/CustomerDashboardOverview';
import CustomerBrowseListings from '@/pages/dashboard/CustomerBrowseListings';
import CustomerSavedItems from '@/pages/dashboard/CustomerSavedItems';
import CustomerOrders from '@/pages/dashboard/CustomerOrders';
import VendorOverview from '@/pages/vendor/VendorOverview';
import AdminOverview from '@/pages/admin/AdminOverview';

function AppRoutes() {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/todos" element={<TodoApp />} />

      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/marketplace" element={<Marketplace />} />
      <Route path="/listing/:id" element={<ListingDetail />} />
      <Route path="/vendors" element={<Vendors />} />
      <Route path="/vendor/:id" element={<Vendors />} />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <CustomerDashboardOverview />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/browse"
        element={
          <ProtectedRoute>
            <CustomerBrowseListings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/saved"
        element={
          <ProtectedRoute>
            <CustomerSavedItems />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/orders"
        element={
          <ProtectedRoute>
            <CustomerOrders />
          </ProtectedRoute>
        }
      />

      <Route
        path="/vendor"
        element={
          <ProtectedRoute requiredRole="vendor">
            <VendorOverview />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminOverview />
          </ProtectedRoute>
        }
      />

      {/* Existing protected routes */}
      <Route 
        path="/create-listing" 
        element={
          <ProtectedRoute>
            <CreateListing />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/edit-listing/:id" 
        element={
          <ProtectedRoute>
            <CreateListing />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/profile" 
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } 
      />
      <Route path="/profile/:id" element={<Profile />} />
      <Route 
        path="/wallet" 
        element={
          <ProtectedRoute>
            <WalletPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/messages" 
        element={
          <ProtectedRoute>
            <Messages />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/notifications" 
        element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/become-vendor" 
        element={
          <ProtectedRoute>
            <BecomeVendor />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/vendor-dashboard" 
        element={
          <ProtectedRoute>
            <BecomeVendor />
          </ProtectedRoute>
        } 
      />
      {/* (Removed legacy duplicate /admin route; /admin now uses AdminOverview) */}

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="top-center" />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
