import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Menu, X, Wallet, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth, useNotifications } from '@/hooks';
import { formatCurrency } from '@/lib/supabase';

export function Header() {
  const { user, signOut, isAuthenticated } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <img 
              src="https://www.image2url.com/r2/default/images/1776291325612-815cb1f3-75d4-4b43-b9cf-16a0451df20a.png" 
              alt="HikmahHub" 
              className="h-10 w-auto"
            />
            <span className="text-xl font-bold text-emerald-700 hidden sm:block">HikmahHub</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link to="/" className="text-gray-600 hover:text-emerald-600 font-medium">
              Home
            </Link>
            <Link to="/marketplace" className="text-gray-600 hover:text-emerald-600 font-medium">
              Marketplace
            </Link>
            <Link to="/vendors" className="text-gray-600 hover:text-emerald-600 font-medium">
              Vendors
            </Link>
          </nav>

          {/* Right Section */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                {/* Wallet */}
                <button 
                  onClick={() => navigate('/wallet')}
                  className="flex items-center space-x-1 bg-emerald-50 px-3 py-1.5 rounded-full"
                >
                  <Wallet className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">
                    {formatCurrency(user?.wallet_balance || 0)}
                  </span>
                </button>

                {/* Notifications */}
                <button 
                  onClick={() => navigate('/notifications')}
                  className="relative p-2 text-gray-600 hover:text-emerald-600"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Profile Dropdown */}
                <div className="relative group">
                  <button 
                    onClick={() => navigate('/profile')}
                    className="flex items-center space-x-2"
                  >
                    <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      {user?.profile_image ? (
                        <img 
                          src={user.profile_image} 
                          alt={user.name} 
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <User className="h-4 w-4 text-emerald-600" />
                      )}
                    </div>
                  </button>
                  
                  {/* Dropdown Menu */}
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <div className="py-1">
                      <Link 
                        to="/profile" 
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Profile
                      </Link>
                      <Link 
                        to="/my-listings" 
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        My Listings
                      </Link>
                      <Link 
                        to="/messages" 
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Messages
                      </Link>
                      <hr className="my-1" />
                      <button 
                        onClick={signOut}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/login')}
                >
                  Sign In
                </Button>
                <Button 
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => navigate('/signup')}
                >
                  Sign Up
                </Button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <nav className="space-y-2">
              <Link 
                to="/" 
                className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link 
                to="/marketplace" 
                className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                onClick={() => setMobileMenuOpen(false)}
              >
                Marketplace
              </Link>
              <Link 
                to="/vendors" 
                className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                onClick={() => setMobileMenuOpen(false)}
              >
                Vendors
              </Link>
              <Link 
                to="/profile" 
                className="block px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                onClick={() => setMobileMenuOpen(false)}
              >
                Profile
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
