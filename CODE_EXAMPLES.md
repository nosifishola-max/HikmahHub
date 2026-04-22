# HikmahHub - Code Snippets & Examples

## 🎯 Using the Fixed Components

### Using AuthContext in Components

```typescript
// Any component can now access auth state
import { useAuthContext } from '@/context/AuthContext';

export function MyComponent() {
  const { 
    user, 
    isAuthenticated, 
    loading, 
    signIn, 
    signOut 
  } = useAuthContext();

  if (loading) return <div>Loading...</div>;

  if (!isAuthenticated) {
    return <div>Please log in</div>;
  }

  return (
    <div>
      <h1>Welcome {user?.name}</h1>
      <button onClick={() => signOut()}>Logout</button>
    </div>
  );
}
```

---

### Protecting Routes

```typescript
// In App.tsx
import { ProtectedRoute } from '@/components/ProtectedRoute';

<Route 
  path="/wallet" 
  element={
    <ProtectedRoute>
      <WalletPage />
    </ProtectedRoute>
  } 
/>

// Admin-only route
<Route 
  path="/admin" 
  element={
    <ProtectedRoute requiredRole="admin">
      <AdminDashboard />
    </ProtectedRoute>
  } 
/>
```

---

### Signup with Email Confirmation

```typescript
import { useAuthContext } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

export function SignupForm() {
  const { signUp } = useAuthContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (email: string, password: string, name: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: signupError } = await signUp(email, password, name);
      
      if (signupError) {
        setError(signupError.message);
        return;
      }
      
      // Show success message
      alert('Check your email for confirmation link!');
      navigate('/login');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSignup(email, password, name);
    }}>
      {/* form fields */}
    </form>
  );
}
```

---

### Login with Session Persistence

```typescript
import { useAuthContext } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

export function LoginForm() {
  const { signIn, loading } = useAuthContext();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (email: string, password: string) => {
    try {
      setError(null);
      
      const { data, error: loginError } = await signIn(email, password);
      
      if (loginError) {
        setError(loginError.message);
        return;
      }
      
      // Session is automatically persisted to localStorage
      // User will stay logged in after page refresh
      navigate('/profile');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleLogin(email, password);
    }}>
      {error && <div className="error">{error}</div>}
      {/* form fields */}
    </form>
  );
}
```

---

### Conditional Rendering Based on Auth

```typescript
export function Header() {
  const { user, isAuthenticated, signOut } = useAuthContext();

  return (
    <header>
      {isAuthenticated ? (
        <div>
          <span>Welcome, {user?.name}</span>
          <button onClick={() => signOut()}>Logout</button>
          <Link to="/wallet">Wallet</Link>
        </div>
      ) : (
        <div>
          <Link to="/login">Login</Link>
          <Link to="/signup">Sign Up</Link>
        </div>
      )}
    </header>
  );
}
```

---

### Accessing User Data

```typescript
export function ProfileHeader() {
  const { user, loading } = useAuthContext();

  if (loading) return <Skeleton />;
  if (!user) return null;

  return (
    <div>
      <img src={user.profile_image} alt={user.name} />
      <h1>{user.name}</h1>
      <p>Email: {user.email}</p>
      <p>Campus: {user.campus}</p>
      <p>Wallet: ₦{formatCurrency(user.wallet_balance)}</p>
    </div>
  );
}
```

---

### Email Confirmation Handling

```typescript
// This is automatically handled by AuthCallback.tsx
// But if you need custom handling:

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export function EmailConfirmation() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleConfirmation = async () => {
      try {
        // Session is already established by Supabase
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // User is confirmed!
          navigate('/profile');
        }
      } catch (error) {
        console.error('Confirmation error:', error);
        navigate('/login');
      }
    };

    handleConfirmation();
  }, [navigate]);

  return <div>Confirming email...</div>;
}
```

---

### Checking Authentication Before API Calls

```typescript
export function useProtectedAPI() {
  const { session, user } = useAuthContext();

  const fetchUserListings = async () => {
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/listings?user_id=${user?.id}`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    return response.json();
  };

  return { fetchUserListings };
}
```

---

### Conditional Page Access

```typescript
export function WalletPage() {
  const { user, isAuthenticated, loading } = useAuthContext();
  const navigate = useNavigate();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    // This shouldn't happen if ProtectedRoute is used
    // But it's good defensive programming
    navigate('/login');
    return null;
  }

  if (user?.role === 'admin') {
    // Show admin wallet features
    return <AdminWallet />;
  }

  if (user?.role === 'vendor') {
    // Show vendor wallet features
    return <VendorWallet />;
  }

  // Show regular user wallet
  return <UserWallet />;
}
```

---

### Role-Based Conditional UI

```typescript
export function Sidebar() {
  const { user } = useAuthContext();

  return (
    <nav>
      <Link to="/profile">Profile</Link>
      <Link to="/wallet">Wallet</Link>
      
      {user?.role === 'vendor' && (
        <>
          <Link to="/vendor-dashboard">Dashboard</Link>
          <Link to="/create-listing">New Listing</Link>
        </>
      )}
      
      {user?.role === 'admin' && (
        <Link to="/admin">Admin Panel</Link>
      )}
    </nav>
  );
}
```

---

### Logout Functionality

```typescript
export function LogoutButton() {
  const { signOut } = useAuthContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await signOut();
      // Session is cleared from localStorage
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleLogout} 
      disabled={loading}
    >
      {loading ? 'Logging out...' : 'Logout'}
    </button>
  );
}
```

---

### Update User Profile

```typescript
export function EditProfile() {
  const { user, updateProfile } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async (updates: Partial<User>) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: updateError } = await updateProfile(updates);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // User updated!
      alert('Profile updated successfully');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleUpdate({
        name: newName,
        phone: newPhone,
        campus: newCampus,
      });
    }}>
      {error && <div className="error">{error}</div>}
      {/* form fields */}
    </form>
  );
}
```

---

### Refresh User Data

```typescript
export function ProfileSettings() {
  const { refreshUser, loading } = useAuthContext();
  const [justRefreshed, setJustRefreshed] = useState(false);

  const handleRefresh = async () => {
    try {
      await refreshUser();
      setJustRefreshed(true);
      setTimeout(() => setJustRefreshed(false), 2000);
    } catch (error) {
      console.error('Refresh error:', error);
    }
  };

  return (
    <div>
      <button 
        onClick={handleRefresh} 
        disabled={loading}
      >
        {loading ? 'Refreshing...' : 'Refresh Profile'}
      </button>
      {justRefreshed && <p>Profile refreshed!</p>}
    </div>
  );
}
```

---

### Check If Loading

```typescript
export function App() {
  const { loading } = useAuthContext();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin">
          <Spinner />
        </div>
      </div>
    );
  }

  return <MainApp />;
}
```

---

### Handle Auth Errors Gracefully

```typescript
export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'email' | 'password' | 'general' | null>(null);
  const { signIn } = useAuthContext();

  const handleLogin = async (email: string, password: string) => {
    try {
      setError(null);
      setErrorType(null);

      if (!email) {
        setError('Email is required');
        setErrorType('email');
        return;
      }

      if (!password) {
        setError('Password is required');
        setErrorType('password');
        return;
      }

      const { data, error: loginError } = await signIn(email, password);

      if (loginError) {
        if (loginError.message.includes('Invalid')) {
          setError('Invalid email or password');
        } else if (loginError.message.includes('Email')) {
          setError('Email not confirmed');
        } else {
          setError(loginError.message);
        }
        setErrorType('general');
        return;
      }

      // Success
      navigate('/profile');
    } catch (err: any) {
      setError('An unexpected error occurred');
      setErrorType('general');
    }
  };

  return (
    <form>
      <input
        type="email"
        placeholder="Email"
        onChange={(e) => setEmail(e.target.value)}
        className={errorType === 'email' ? 'border-red-500' : ''}
      />
      {errorType === 'email' && <p className="error">{error}</p>}

      <input
        type="password"
        placeholder="Password"
        onChange={(e) => setPassword(e.target.value)}
        className={errorType === 'password' ? 'border-red-500' : ''}
      />
      {errorType === 'password' && <p className="error">{error}</p>}

      {errorType === 'general' && (
        <div className="bg-red-50 border border-red-200 p-4 rounded">
          {error}
        </div>
      )}

      <button type="submit">Login</button>
    </form>
  );
}
```

---

### TypeScript Types

```typescript
// User type
interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  department: string | null;
  level: string | null;
  campus: string;
  profile_image: string | null;
  role: 'student' | 'vendor' | 'admin';
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  wallet_balance: number;
  total_spent: number;
  total_cashback_earned: number;
  referral_code: string | null;
  referred_by: string | null;
  referral_earnings: number;
  listings_count: number;
  free_listing_used: boolean;
  created_at: string;
  updated_at: string;
}

// AuthContext type
interface AuthContextType {
  user: User | null;
  session: any | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isVendor: boolean;
  signUp: (email: string, password: string, name: string, referralCode?: string) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<any>;
  refreshUser: () => Promise<void>;
}
```

---

### Testing the Auth System

```typescript
// In browser console

// Check if logged in
const { user } = useAuthContext(); // ❌ Can't call hooks in console
// Instead, check localStorage:
JSON.parse(localStorage.getItem('supabase.auth.token') || '{}')

// Sign in
await supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'password123'
})

// Sign out
await supabase.auth.signOut()

// Check current session
const { data: { session } } = await supabase.auth.getSession()
console.log(session)

// Check current user
const { data: { user } } = await supabase.auth.getUser()
console.log(user)

// Test protected route access
// Try navigating to /wallet while logged out - should redirect to /login
```

---

These examples cover the most common use cases for working with the fixed auth system! 🚀
