# HikmahHub Architecture & Data Flow Diagrams

## 🏗️ Application Architecture

```
┌─────────────────────────────────────────────────┐
│              HikmahHub Application              │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │         ErrorBoundary                   │   │
│  ├─────────────────────────────────────────┤   │
│  │                                         │   │
│  │  ┌──────────────────────────────────┐  │   │
│  │  │      BrowserRouter               │  │   │
│  │  ├──────────────────────────────────┤  │   │
│  │  │                                  │  │   │
│  │  │  ┌───────────────────────────┐  │  │   │
│  │  │  │   AuthProvider            │  │  │   │
│  │  │  │  (Global State)           │  │  │   │
│  │  │  ├───────────────────────────┤  │  │   │
│  │  │  │                           │  │  │   │
│  │  │  │  ┌──────────────────────┐ │  │  │   │
│  │  │  │  │  Routes              │ │  │  │   │
│  │  │  │  ├──────────────────────┤ │  │  │   │
│  │  │  │  │ /auth/callback       │ │  │  │   │
│  │  │  │  │ /login               │ │  │  │   │
│  │  │  │  │ /signup              │ │  │  │   │
│  │  │  │  │ /                    │ │  │  │   │
│  │  │  │  │ ProtectedRoute       │ │  │  │   │
│  │  │  │  │  ├─ /profile         │ │  │  │   │
│  │  │  │  │  ├─ /wallet          │ │  │  │   │
│  │  │  │  │  ├─ /messages        │ │  │  │   │
│  │  │  │  │  └─ /admin           │ │  │  │   │
│  │  │  │  │                      │ │  │  │   │
│  │  │  │  └──────────────────────┘ │  │  │   │
│  │  │  │                           │  │  │   │
│  │  │  └───────────────────────────┘  │  │   │
│  │  │                                  │  │   │
│  │  └──────────────────────────────────┘  │   │
│  │                                         │   │
│  │         Toaster (Notifications)        │   │
│  │                                         │   │
│  └─────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🔐 Authentication Flow

### Email Confirmation Flow
```
User Signup
    ↓
/signup page
    ↓
User enters email + password
    ↓
Supabase.auth.signUp()
    ↓
Email sent with confirmation link
    ↓
User clicks email link
    ↓
Redirects to: /auth/callback?code=xxx&type=signup
    ↓
AuthCallback component processes
    ↓
Supabase confirms email via code
    ↓
Session established in AuthContext
    ↓
Redirects to: /
    ↓
User logged in ✓
    ↓
Session saved to localStorage
    ↓
Can navigate to /profile ✓
```

### Session Persistence Flow
```
App Loads
    ↓
AuthContext useEffect runs
    ↓
supabase.auth.getSession()
    ↓
Check localStorage for saved session
    ↓
Session Found?
    │
    ├─ YES → Load user profile
    │         Set user state
    │         Ready to render
    │
    └─ NO → Set loading false
            Render public pages
            Show login prompt for protected
```

### Protected Route Access
```
User navigates to /wallet
    ↓
React Router routes to ProtectedRoute component
    ↓
ProtectedRoute checks: authLoading?
    │
    ├─ YES → Show loading spinner
    │         Wait for auth to initialize
    │
    └─ NO → Check: isAuthenticated?
            │
            ├─ YES → Render WalletPage ✓
            │
            └─ NO → Redirect to /login
```

---

## 📊 Data Flow Diagram

```
┌──────────────────┐
│   User Action    │
│   (Click button) │
└────────┬─────────┘
         ↓
┌──────────────────────────┐
│  Component Event Handler │
│  (onClick, onChange)     │
└────────┬─────────────────┘
         ↓
┌──────────────────────────────┐
│  Call AuthContext function   │
│  (signUp, signIn, signOut)   │
└────────┬─────────────────────┘
         ↓
┌──────────────────────────────┐
│  Supabase API Call           │
│  (/auth/v1/signup, /token)   │
└────────┬─────────────────────┘
         ↓
┌──────────────────────────────┐
│  Server Response             │
│  (Session token, User data)  │
└────────┬─────────────────────┘
         ↓
┌──────────────────────────────┐
│  Update AuthContext State    │
│  (setUser, setSession)       │
└────────┬─────────────────────┘
         ↓
┌──────────────────────────────┐
│  Save to localStorage        │
│  (supabase.auth.token)       │
└────────┬─────────────────────┘
         ↓
┌──────────────────────────────┐
│  Trigger React Re-render     │
│  (All consumers updated)     │
└────────┬─────────────────────┘
         ↓
┌──────────────────────────────┐
│  Component Displays Result   │
│  (Redirect, Show Profile)    │
└──────────────────────────────┘
```

---

## 🔄 Component Dependency Tree

```
App
├─ ErrorBoundary
├─ BrowserRouter
│  └─ AuthProvider
│     ├─ useAuth() [Internal]
│     ├─ useEffect() [Init session]
│     ├─ useEffect() [Listen to changes]
│     └─ Routes
│        ├─ Route /auth/callback
│        │  └─ AuthCallback
│        ├─ Route /login
│        │  └─ Login
│        │     └─ useAuthContext()
│        ├─ Route /signup
│        │  └─ Signup
│        │     └─ useAuthContext()
│        ├─ Route /
│        │  └─ Home
│        ├─ Route /profile/:id
│        │  └─ Profile
│        │     ├─ useAuthContext()
│        │     ├─ useListings()
│        │     └─ useVendors()
│        ├─ Route /wallet
│        │  └─ ProtectedRoute
│        │     ├─ useAuthContext()
│        │     └─ WalletPage
│        │        └─ useAuth()
│        ├─ Route /messages
│        │  └─ ProtectedRoute
│        │     └─ Messages
│        ├─ Route /admin
│        │  └─ ProtectedRoute (role="admin")
│        │     └─ AdminDashboard
│        └─ ...other routes
│
└─ Toaster
   └─ Toast notifications
```

---

## 📱 Mobile Session Persistence

### Desktop Flow
```
Browser opens app
    ↓
App loads & initializes
    ↓
AuthContext checks localStorage
    ↓
Session found? YES
    ↓
Restore session
    ↓
User sees profile immediately
    ↓
Refresh browser (F5)
    ↓
Session STILL there ✓
```

### Mobile App Flow (React Native / Expo)
```
App opens
    ↓
AppState listener detects "active"
    ↓
App initializes
    ↓
AuthContext checks AsyncStorage
    ↓
Session found? YES
    ↓
Restore session
    ↓
User sees profile immediately
    ↓
Close and reopen app
    ↓
Session STILL there ✓
    ↓
Offline-first ready
```

---

## 🔌 API & Database Integration

```
┌──────────────────────────────────────────────┐
│           React Frontend                     │
│      (HikmahHub Web App on Vercel)          │
└───────────┬────────────────────────────────┘
            │
            │ HTTPS Requests
            │
        ┌───┴──────────────────────────────────┐
        │   Supabase Cloud (API Server)       │
        ├───────────────────────────────────────┤
        │                                       │
        │  Auth Service (JWT Tokens)           │
        │   ├─ /auth/v1/signup                 │
        │   ├─ /auth/v1/signin                 │
        │   ├─ /auth/v1/token (refresh)        │
        │   └─ /auth/v1/user (profile)         │
        │                                       │
        │  REST API                             │
        │   ├─ /rest/v1/users                  │
        │   ├─ /rest/v1/listings               │
        │   ├─ /rest/v1/vendors                │
        │   └─ /rest/v1/messages               │
        │                                       │
        │  Real-time Subscriptions              │
        │   ├─ messages_channel                 │
        │   ├─ listings_channel                 │
        │   └─ notifications_channel            │
        │                                       │
        └─────┬──────────────────────────────┘
              │
          ┌───┴────────────────────────────┐
          │  PostgreSQL Database          │
          ├───────────────────────────────┤
          │ • users table                 │
          │ • listings table              │
          │ • vendors table               │
          │ • messages table              │
          │ • wallets table               │
          │ • transactions table          │
          │ • auth tokens                 │
          │ (Row-Level Security enabled)  │
          └───────────────────────────────┘
```

---

## 🌐 Browser LocalStorage Structure

```
localStorage = {
  "supabase.auth.token": {
    "currentSession": {
      "user": {
        "id": "uuid",
        "email": "user@example.com",
        "user_metadata": {
          "name": "User Name"
        }
      },
      "access_token": "eyJhbGc...",
      "refresh_token": "xxxx",
      "expires_in": 3600,
      "expires_at": 1234567890,
      "token_type": "bearer"
    },
    "expiresAt": 1234567890
  },
  
  "supabase.auth.cache": {
    "somekey": "somevalue"
  }
}
```

---

## 🔐 Security Architecture

```
┌─────────────────────────────────────────────┐
│    Client (Browser)                         │
├─────────────────────────────────────────────┤
│                                             │
│  HTTPS Only (Vercel enforces)              │
│  ↓                                          │
│  PKCE OAuth Flow                           │
│  ├─ Code Challenge generated client-side   │
│  ├─ Code Verifier sent in token exchange   │
│  └─ Prevents auth code interception        │
│                                             │
│  Session Storage                            │
│  ├─ Token stored in secure location        │
│  ├─ Sent with HTTPS requests               │
│  └─ Never exposed in URLs                  │
│                                             │
│  Security Headers                           │
│  ├─ X-Content-Type-Options: nosniff        │
│  ├─ X-Frame-Options: SAMEORIGIN            │
│  ├─ X-XSS-Protection: 1; mode=block        │
│  └─ Referrer-Policy: strict-origin         │
│                                             │
│  CORS Configuration                         │
│  ├─ Whitelist allowed origins              │
│  ├─ Only allow specific methods (GET, POST)│
│  └─ Preflight checks enabled               │
│                                             │
└─────────────────────────────────────────────┘
              ↓ HTTPS
┌─────────────────────────────────────────────┐
│    Supabase Server                          │
├─────────────────────────────────────────────┤
│                                             │
│  JWT Validation                             │
│  ├─ Verify token signature                  │
│  ├─ Check expiration                        │
│  └─ Extract user information                │
│                                             │
│  Row-Level Security (RLS)                  │
│  ├─ users can only see their own data      │
│  ├─ public data visible to all             │
│  └─ admin can see everything               │
│                                             │
│  Database Encryption                        │
│  ├─ Data encrypted at rest                  │
│  ├─ Encrypted in transit (SSL/TLS)         │
│  └─ Automatic backups encrypted            │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🎯 State Management Flow

```
┌────────────────────────────────────────┐
│        AuthContext Provider            │
├────────────────────────────────────────┤
│                                        │
│  State Variables:                      │
│  • user: User | null                   │
│  • session: Session | null             │
│  • loading: boolean                    │
│                                        │
│  Functions:                            │
│  • signUp()                            │
│  • signIn()                            │
│  • signOut()                           │
│  • updateProfile()                     │
│  • refreshUser()                       │
│                                        │
│  Effects:                              │
│  • Initialize on mount                 │
│  • Listen to auth state changes        │
│  • Cleanup subscriptions               │
│                                        │
└─────────────┬──────────────────────────┘
              │
              │ useAuthContext()
              │
    ┌─────────┴──────────┬──────────┬────────┐
    │                    │          │        │
   ▼                   ▼          ▼        ▼
 Login            Profile        Wallet   Admin
 Component       Component      Component Dashboard
    │                │            │         │
    ├─ signIn()     ├─ Load       ├─ Load ├─ Check
    ├─ Check        │   profile   │   balance   role
    │   loading     │   data      └─ Render    └─ Render
    └─ Render       └─ Render       form      panel
       form            content
```

---

## 📈 Routing Table

```
┌─────────────────────┬─────────────────┬──────────────┬─────────┐
│ Route               │ Component       │ Protection   │ Auth    │
├─────────────────────┼─────────────────┼──────────────┼─────────┤
│ /                   │ Home            │ None         │ Public  │
│ /login              │ Login           │ None         │ Public  │
│ /signup             │ Signup          │ None         │ Public  │
│ /auth/callback      │ AuthCallback    │ None         │ Public  │
│ /marketplace        │ Marketplace     │ None         │ Public  │
│ /listing/:id        │ ListingDetail   │ None         │ Public  │
│ /vendors            │ Vendors         │ None         │ Public  │
│ /vendor/:id         │ Vendors         │ None         │ Public  │
│ /profile            │ Profile         │ Protected    │ Required│
│ /profile/:id        │ Profile         │ None         │ Public  │
│ /wallet             │ WalletPage      │ Protected    │ Required│
│ /messages           │ Messages        │ Protected    │ Required│
│ /create-listing     │ CreateListing   │ Protected    │ Required│
│ /edit-listing/:id   │ CreateListing   │ Protected    │ Required│
│ /become-vendor      │ BecomeVendor    │ Protected    │ Required│
│ /vendor-dashboard   │ BecomeVendor    │ Protected    │ Required│
│ /notifications      │ Notifications   │ Protected    │ Required│
│ /admin              │ AdminDashboard  │ Protected    │ Admin    │
│ *                   │ Navigate to /   │ None         │ Public  │
└─────────────────────┴─────────────────┴──────────────┴─────────┘
```

---

## 🔄 Error Handling Flow

```
User Action
    ↓
Component tries operation
    ↓
Error occurs?
    │
    ├─ NO → Continue normally
    │
    └─ YES → Error caught
             ↓
             Error Boundary?
             │
             ├─ YES → Show fallback UI
             │        Log error
             │        Don't crash
             │
             └─ NO → Specific error handler
                     ├─ Auth error → Redirect to login
                     ├─ Network error → Show retry button
                     ├─ Validation error → Show inline errors
                     └─ Server error → Show error message
                                      ↓
                                      Toaster notification
                                      ↓
                                      User can retry
```

---

## 📊 Performance Optimization

```
Initial Load
    ├─ HTML/CSS/JS downloaded (optimized chunks)
    ├─ Vendor bundles (React, UI libs) loaded
    ├─ App initializes
    ├─ AuthContext checks localStorage
    │  └─ If session found: load user profile (1 query)
    │  └─ If no session: skip profile load
    ├─ Routes render
    └─ Page visible (optimized FCP)

On Route Change
    ├─ React Router handles routing (instant)
    ├─ New component mounts
    ├─ useEffect hooks run
    │  └─ Protected routes check auth (no API call)
    │  └─ Data components fetch needed data
    ├─ Data loads (parallel queries)
    └─ Component renders

Code Splitting
    ├─ vendor-react: React, React Router
    ├─ vendor-ui: UI Components
    ├─ vendor-supabase: Supabase client
    ├─ vendor-utils: Utilities
    ├─ marketplace: Marketplace page
    ├─ profile: Profile page
    ├─ vendors: Vendors page
    └─ messages: Messages page
```

---

These diagrams show how all the pieces fit together to create a robust, secure, mobile-friendly authentication system! 🚀
