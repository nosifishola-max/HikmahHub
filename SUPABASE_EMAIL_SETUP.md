# Supabase Email Configuration Guide

## 🔧 Step 1: Update Email Templates

### Confirm Signup Email Template
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to: **Authentication → Email Templates**
4. Click **Confirm Signup** template
5. Update the confirmation URL to:
   ```
   {{ .ConfirmationURL }}
   ```
   OR if you want to use a custom redirect:
   ```
   {{ .SiteURL }}/auth/callback?code={{ .ConfirmationCode }}&type=signup
   ```

### Example Updated Email Template:
```html
<h2>Confirm your email</h2>
<p>Follow this link to confirm your email address.</p>
<p>
  <a href="{{ .ConfirmationURL }}">Confirm email</a>
</p>
<hr />
<p>This link expires in {{ .LinkExpiryDuration }}.</p>
```

---

## 🌐 Step 2: Configure CORS & URL Settings

1. Go to **Authentication → URL Configuration**
2. Add the following URLs:

### Production URLs:
```
https://hikmahhub.vercel.app
https://hikmahhub.ng
https://www.hikmahhub.ng
```

### Development URLs:
```
http://localhost:3000
http://localhost:5173
http://localhost:8080
```

### Mobile/Custom URLs (if applicable):
```
exp://localhost:19000
io.hikmahhub://
```

---

## 🔐 Step 3: Configure OAuth Redirect URLs

If using OAuth (Google, GitHub, etc.):

1. Go to **Authentication → Providers**
2. For each OAuth provider:
   - **Google, GitHub, etc.**
   - Set "Redirect URL" (if not auto-filled) to:
     ```
     https://hikmahhub.vercel.app/auth/callback
     ```

---

## 📧 Step 4: Email Provider Configuration

### Option A: Use Supabase Email (Default)
- Comes with free tier (2 emails per minute limit)
- Suitable for development only

### Option B: Use SendGrid (Recommended for Production)
1. Create SendGrid account at https://sendgrid.com
2. Get API key
3. In Supabase Dashboard → Authentication → Email Settings:
   - Toggle **Custom SMTP**
   - Fill in SendGrid credentials:
     ```
     Host: smtp.sendgrid.net
     Port: 587
     Username: apikey
     Password: YOUR_SENDGRID_API_KEY
     ```

### Option C: Use Resend (Modern Alternative)
1. Create account at https://resend.com
2. Get API key
3. Configure similar to SendGrid

---

## 🔐 Step 5: Authentication Settings

1. Go to **Authentication → Policies**
2. Configure:
   - **Email confirmations**: Enable (required)
   - **Double confirm changes**: Optional
   - **Enable signup**: Yes
   - **Confirm email before using**: Yes (recommended)

3. Go to **Authentication → JWT Settings**:
   - JWT Expiry: 3600 (1 hour)
   - Refresh Token Rotation: Enabled

---

## 🧪 Step 6: Test Email Confirmation

### Local Testing:
```bash
cd app
npm run dev
# Go to http://localhost:5173/signup
# Sign up with test email
# Check terminal for email link or Supabase logs
```

### Production Testing:
```bash
# Go to https://hikmahhub.vercel.app/signup
# Sign up with real email
# Check inbox (including spam)
# Click confirmation link
# Should redirect to /auth/callback then home
```

---

## ⚙️ Environment Variables (Vercel)

Set these in Vercel Dashboard → Settings → Environment Variables:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_API_URL=https://api.hikmahhub.com
```

---

## 🐛 Troubleshooting

### Email not being sent:
- Check Supabase logs: Dashboard → Logs → Auth
- Verify email provider is configured
- Check spam folder
- Try resending with different email

### "Site cannot be reached" after email link:
- Verify CORS URLs are configured
- Check redirect URL in vercel.json
- Verify /auth/callback route exists
- Check browser console for errors

### Session not persisting after confirmation:
- Verify `persistSession: true` in supabase.ts
- Check localStorage for `supabase.auth.token`
- Verify no errors in browser console
- Check Network tab for auth API calls

### Different session on mobile:
- Clear app cache
- Clear localStorage: `localStorage.clear()`
- Re-login
- Check Supabase dashboard for multiple sessions

---

## 📱 Mobile-Specific Setup

### For Expo/React Native (if needed):
```javascript
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Mobile doesn't use URLs
  },
});
```

### For Custom Deep Links:
Set redirect URL to:
```
io.hikmahhub://auth/callback
```

Then handle in deep link listener.

---

## ✅ Verification Checklist

- [ ] Email template updated
- [ ] CORS URLs configured
- [ ] OAuth redirect URLs set
- [ ] Email provider configured (SMTP or SendGrid)
- [ ] JWT expiry set appropriately
- [ ] Environment variables in Vercel
- [ ] Local signup/email test passed
- [ ] Production email test passed
- [ ] Mobile email test passed
- [ ] Session persists after confirmation
