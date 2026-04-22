# HikmahHub Development Setup & Testing Guide

## 🚀 Local Development Setup

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Git
- Supabase account
- Vercel account (optional for local dev)

### Installation

```bash
# Clone repository
git clone https://github.com/your-repo/HikmahHub.ng.git
cd HikmahHub.ng

# Install dependencies
cd app
npm install

# Create .env.local file
cp .env.example .env.local
```

### Configure Environment Variables

Create `.env.local` in `/app` directory:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# API
VITE_API_URL=http://localhost:3001

# Optional: Paystack
VITE_PAYSTACK_PUBLIC_KEY=pk_test_xxx
```

### Start Development Server

```bash
cd app
npm run dev

# Server runs at http://localhost:5173
```

---

## 🧪 Testing Workflows

### Test 1: Local Signup with Email Confirmation

```bash
# 1. Start dev server
npm run dev

# 2. Go to http://localhost:5173/signup

# 3. Enter credentials:
# Email: test@example.com
# Password: TestPassword123
# Name: Test User

# 4. Check console output for email link
# (Supabase dev mode prints links to console)

# 5. Copy the confirmation link and paste in browser
# OR
# Check your email (if SMTP configured)

# 6. Should redirect to home page
# 7. Check localStorage for auth token
localStorage.getItem('supabase.auth.token')
```

### Test 2: Profile Page Access

```bash
# Test direct access to /profile
# 1. While logged out:
#    - Go to http://localhost:5173/profile
#    - Should redirect to /login

# 2. Login first:
#    - Go to /login
#    - Enter credentials
#    - Should redirect to home

# 3. Go to http://localhost:5173/profile
#    - Should show your profile
#    - Edit button should be visible

# 4. Go to http://localhost:5173/profile/some-other-id
#    - Should show other user's profile
#    - Edit button should NOT be visible
```

### Test 3: Session Persistence

```javascript
// Open browser DevTools console

// 1. Login
// 2. Run this command
localStorage.getItem('supabase.auth.token')
// Should return a token object

// 3. Refresh the page (Cmd/Ctrl + R)
// 4. Should still be logged in
// 5. Profile page should load immediately
// 6. Run again - token should still exist
localStorage.getItem('supabase.auth.token')
```

### Test 4: Protected Routes

```bash
# Test that protected routes redirect properly

# While LOGGED OUT, visit:
# /wallet - should redirect to /login ✓
# /messages - should redirect to /login ✓
# /create-listing - should redirect to /login ✓
# /admin - should redirect to /login ✓

# While LOGGED IN, visit:
# /wallet - should load ✓
# /messages - should load ✓
# /create-listing - should load ✓
# /profile - should load ✓

# Admin only (if not admin):
# /admin - should redirect to home ✓
```

### Test 5: Mobile Testing

```bash
# Method 1: Browser DevTools
# 1. Open DevTools (F12)
# 2. Click device toggle (top left)
# 3. Select "iPhone 12" or "Pixel 5"
# 4. Reload page
# 5. Test all flows

# Method 2: Local Network (Real Mobile)
# 1. Get your computer's IP: 
#    - Windows: ipconfig | grep IPv4
#    - Mac: ifconfig | grep inet
# 2. On mobile, visit http://<your-ip>:5173
# 3. Test signup, login, profile
# 4. Test session persistence

# Method 3: Android Emulator
# 1. Run Android Studio emulator
# 2. Visit http://10.0.2.2:5173
# 3. Test flows
```

---

## 🐛 Debugging

### Check Auth State

```javascript
// In browser console:

// Get current session
const session = await supabase.auth.getSession();
console.log(session);

// Get current user
const user = await supabase.auth.getUser();
console.log(user);

// Listen to auth changes
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (_event, session) => {
    console.log('Auth event:', _event, session);
  }
);

// Cleanup
subscription?.unsubscribe();
```

### Check LocalStorage

```javascript
// View all stored data
console.log(localStorage);

// Check auth token
console.log(localStorage.getItem('supabase.auth.token'));

// Check other keys
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  console.log(key, localStorage.getItem(key));
}
```

### Monitor Network Requests

```
1. Open DevTools → Network tab
2. Filter by XHR/Fetch
3. Look for:
   - /auth/v1/signup (signup request)
   - /auth/v1/token (token refresh)
   - /auth/v1/user (user info)
   - /rest/v1/users (profile data)
4. Check response status and error messages
```

### View Supabase Logs

```
1. Go to Supabase Dashboard
2. Click your project
3. Go to Logs → Auth (for auth logs)
4. Go to Logs → API (for API requests)
5. Search for errors or specific user
```

---

## 🔧 Common Issues & Fixes

### Issue: Auth token not saving to localStorage

**Solution:**
```javascript
// Verify persistSession is enabled
console.log(supabase.auth.mfa); // Check auth config

// Force re-login
await supabase.auth.signOut();
// Re-login

// Check browser settings:
// - Not in private/incognito mode
// - LocalStorage not disabled
// - Cookies enabled
```

### Issue: /profile shows blank page

**Solution:**
```bash
# 1. Check console errors (F12 → Console)
# 2. Check that you're logged in
#    localStorage.getItem('supabase.auth.token')
# 3. Check AuthContext is working
#    All routes should be wrapped with AuthProvider
# 4. Check Supabase connection
#    Open Network tab and check /auth/v1/user call
```

### Issue: Email confirmation link doesn't work

**Solution:**
```javascript
// Check Supabase email template
// 1. Dashboard → Authentication → Email Templates
// 2. Confirm "Confirm Signup" uses {{ .ConfirmationURL }}
// 3. Check CORS URLs configured
// 4. Test locally:
//    - Check console for email link
//    - Check redirect URL
//    - Click and verify redirect works
```

### Issue: Profile data not loading

**Solution:**
```javascript
// Check user profile exists
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)
  .single();

console.log(data); // Should exist

// Check listings query
const { data: listings } = await supabase
  .from('listings')
  .select('*')
  .eq('user_id', userId);

console.log(listings); // Should have data
```

### Issue: Mobile session not persisting

**Solution:**
```javascript
// 1. Verify Supabase config on mobile
//    Check supabase.ts persistSession: true

// 2. Clear browser storage
localStorage.clear();
sessionStorage.clear();

// 3. Close app completely and reopen

// 4. Check for errors in console
//    - Network errors
//    - Storage errors
//    - Auth errors
```

---

## 📱 Mobile Testing Checklist

### Before Testing on Mobile:
- [ ] Dev server running: `npm run dev`
- [ ] Get your IP: `ipconfig` (Windows) or `ifconfig` (Mac)
- [ ] Mobile on same WiFi network
- [ ] HTTPS not required for local dev

### Test Cases:
- [ ] Page loads without errors
- [ ] All buttons tappable (44px minimum)
- [ ] Forms work properly
- [ ] Keyboard doesn't break layout
- [ ] Images load correctly
- [ ] Scrolling is smooth
- [ ] No layout shifts
- [ ] Session persists after refresh
- [ ] Signup with email works
- [ ] Profile page loads
- [ ] Responsive design works

### Browser Testing:
- [ ] Chrome mobile
- [ ] Safari mobile
- [ ] Firefox mobile
- [ ] Samsung Internet

---

## 🚀 Build & Deploy Locally

### Build for Production

```bash
npm run build

# Output goes to: app/dist/

# Check build size
du -sh dist/

# List files
ls -la dist/
```

### Preview Build Locally

```bash
npm run preview

# Runs on http://localhost:5173
# Tests production build locally
```

### Deploy to Vercel (Manual)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Select project
# Confirm deployment settings
# Get preview URL
```

---

## 📊 Performance Testing

### Lighthouse Audit

```bash
# 1. Build for production
npm run build

# 2. Preview build
npm run preview

# 3. Open Chrome DevTools
# 4. Click Lighthouse tab
# 5. Click "Analyze page load"
# 6. Check scores:
#    - Performance > 80
#    - Accessibility > 95
#    - Best Practices > 95
#    - SEO > 90
```

### Bundle Analysis

```bash
# Check bundle size
npm run build

# Look at vite build output for:
# - Total size
# - Chunk sizes
# - Largest modules
```

---

## 🧪 Running Tests (When Set Up)

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

---

## 🎯 Development Best Practices

### Code Quality
- [ ] Follow TypeScript strict mode
- [ ] No `any` types without reason
- [ ] Proper error handling
- [ ] Loading states for all async
- [ ] Error boundary around components
- [ ] Proper console.log cleanup before commit

### Performance
- [ ] Code split routes
- [ ] Lazy load images
- [ ] Memoize expensive computations
- [ ] Avoid unnecessary re-renders
- [ ] Use proper key props for lists

### Security
- [ ] No API keys in client code
- [ ] Use environment variables
- [ ] Validate user input
- [ ] Sanitize output
- [ ] Check authentication on routes
- [ ] Use HTTPS in production

### Testing
- [ ] Test critical flows manually
- [ ] Test on multiple browsers
- [ ] Test on mobile
- [ ] Test with slow network
- [ ] Test with no network
- [ ] Test loading states
- [ ] Test error states

---

## 📝 Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes and test locally
npm run dev
# Test everything...

# Build to verify production build
npm run build
npm run preview

# Commit changes
git add .
git commit -m "feat: description of changes"

# Push to GitHub
git push origin feature/your-feature

# Create Pull Request on GitHub
# Request review
# Address feedback
# Merge to main

# Vercel auto-deploys from main
```

---

## 🔗 Useful Links

- [Supabase Docs](https://supabase.com/docs)
- [React Router Docs](https://reactrouter.com)
- [Vite Docs](https://vitejs.dev)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [TypeScript Docs](https://www.typescriptlang.org/docs)

---

## ❓ Quick Reference

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Create new page component
# 1. Create file: src/pages/NewPage.tsx
# 2. Export from src/pages/index.ts
# 3. Add route to src/App.tsx

# Create new hook
# 1. Create file: src/hooks/useCustomHook.ts
# 2. Export from src/hooks/index.ts
# 3. Import in component

# Create new UI component
# 1. Create file: src/components/ui/custom.tsx
# 2. Import from shadcn/ui or create custom
# 3. Use in pages/components
```
