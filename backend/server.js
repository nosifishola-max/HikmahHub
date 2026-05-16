const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables
dotenv.config();
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;

// Prefer service/secret key for server-side admin operations; fallback to anon key
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabaseKey = supabaseServiceKey || supabaseAnonKey;

if (!supabaseUrl) {
  console.error('Missing SUPABASE_URL in backend/.env');
}
if (!supabaseKey) {
  console.error('Missing SUPABASE_SECRET_KEY/SUPABASE_ANON_KEY in backend/.env');
}

// Create Supabase client (server/admin)
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

app.use(cors({
  origin: (origin, callback) => {
    const allowed = new Set([
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ].filter(Boolean));

    if (!origin || allowed.has(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// ------------ Helpers ------------

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

async function fetchSupabaseAuthedUser(accessToken) {
  // Validates access token by calling GoTrue user endpoint
  // https://supabase.com/docs/guides/auth/server-side#verify-the-token
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseServiceKey || supabaseAnonKey,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const err = new Error(`Auth validation failed: ${response.status} ${text}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  return data; // contains id, email, sub etc depending on GoTrue config
}

async function getAuthedAppUser(accessToken) {
  const authUser = await fetchSupabaseAuthedUser(accessToken);
  const userId = authUser.id || authUser.sub;

  if (!userId) throw new Error('Invalid auth user payload');

  const { data: appUser, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[auth/me] select users failed:', { userId, error: error.message || String(error) });
    throw error;
  }

  if (!appUser) {
    // Auto-provision app profile on first login so frontend doesn't show "We couldn't find your profile data".
    const nameFromMetadata =
      authUser?.user_metadata?.name ||
      authUser?.user_metadata?.full_name ||
      authUser?.app_metadata?.name ||
      null;

    const insertPayload = {
      id: userId,
      email: authUser?.email || null,
      name: nameFromMetadata || (authUser?.email ? String(authUser.email).split('@')[0] : 'User'),
      role: 'student',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('[auth/me] users row missing. Auto-provisioning...', {
      userId,
      email: authUser?.email,
      nameFromMetadata,
      insertPayload,
    });

    const { data: created, error: createErr } = await supabase
      .from('users')
      .insert(insertPayload)
      .select('*')
      .maybeSingle();

    if (createErr) {
      console.error('[auth/me] auto-provision failed createErr:', {
        userId,
        error: createErr.message || String(createErr),
        details: createErr,
      });
      throw createErr;
    }

    if (!created) {
      const err = new Error('App user profile auto-provision failed (no row returned)');
      err.status = 404;
      throw err;
    }

    console.log('[auth/me] auto-provision succeeded:', { userId, createdId: created.id });
    return { authUser, appUser: created };
  }

  console.log('[auth/me] users row found:', { userId });
  return { authUser, appUser };
}

function requireAuth(req, res) {
  return (async () => {
    const accessToken = getBearerToken(req);
    if (!accessToken) {
      return res.status(401).json({ success: false, error: 'Missing Authorization Bearer token' });
    }

    try {
      const { appUser } = await getAuthedAppUser(accessToken);
      return { accessToken, appUser };
    } catch (err) {
      const status = err?.status || 401;
      return res.status(status).json({
        success: false,
        error: err?.message || 'Unauthorized',
      });
    }
  })();
}

function isNonEmptyString(x) {
  return typeof x === 'string' && x.trim().length > 0;
}

function nowIso() {
  return new Date().toISOString();
}

async function broadcastToUser(wss, userId, payload) {
  const msg = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    if (client.userId && client.userId === userId) {
      client.send(msg);
    }
  }
}

function normalizePriceInput(price) {
  const n = typeof price === 'string' ? Number(price) : price;
  if (!Number.isFinite(n)) return null;
  return n;
}

// ------------ Paystack endpoints (existing) ------------

app.post('/api/paystack/initialize', async (req, res) => {
  try {
    const { email, amount, metadata = {}, type, boostType } = req.body;

    const reference = `HH${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const paystackPayload = {
      email,
      amount: amount * 100, // Convert to kobo
      reference,
      callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
      metadata: {
        ...metadata,
        custom_fields: [
          { display_name: 'Platform', variable_name: 'platform', value: 'HikmahHub' },
          { display_name: 'Payment Type', variable_name: 'payment_type', value: type || 'general' },
        ],
      },
    };

    if (boostType) {
      paystackPayload.metadata.custom_fields.push({
        display_name: 'Boost Type',
        variable_name: 'boost_type',
        value: boostType,
      });
    }

    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload),
    });

    if (!response.ok) throw new Error('Failed to initialize payment');

    const data = await response.json();

    res.json({
      success: true,
      data: {
        authorization_url: data.data.authorization_url,
        access_code: data.data.access_code,
        reference: data.data.reference,
      },
    });
  } catch (error) {
    console.error('Payment initialization error:', error);
    res.status(500).json({ success: false, error: 'Failed to initialize payment' });
  }
});

app.get('/api/paystack/verify/:reference', async (req, res) => {
  try {
    const { reference } = req.params;

    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) throw new Error('Failed to verify payment');

    const data = await response.json();

    if (data?.data?.status === 'success') {
      res.json({
        success: true,
        data: {
          reference: data.data.reference,
          status: data.data.status,
          amount: data.data.amount / 100,
          customer: data.data.customer,
          metadata: data.data.metadata,
        },
      });
    } else {
      res.json({
        success: false,
        data: { reference: data.data.reference, status: data.data.status },
      });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify payment' });
  }
});

// ------------ Health/debug endpoints ------------

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'HikmahHub Backend API is running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/supabase/test', async (req, res) => {
  try {
    const { error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Supabase connection successful',
      data: {
        connection: 'OK',
        timestamp: nowIso(),
        supabaseUrl: supabaseUrl ? 'Configured' : 'Missing',
      },
    });
  } catch (error) {
    console.error('Supabase connection test error:', error);
    res.status(500).json({
      success: false,
      error: 'Supabase connection failed',
      details: error?.message || String(error),
    });
  }
});

app.get('/api/supabase/test/vendors', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vendors')
      .select('id,business_name')
      .limit(3);

    if (error) throw error;

    res.json({
      success: true,
      data,
      info: { timestamp: nowIso() },
    });
  } catch (error) {
    console.error('Supabase vendors test error:', error);
    res.status(500).json({
      success: false,
      error: 'Supabase vendors query failed',
      details: error?.message || String(error),
      timestamp: nowIso(),
    });
  }
});

// ------------ Auth (GoTrue proxy) ------------

app.post('/api/auth/sign-up', async (req, res) => {
  try {
    const { email, password, name, referralCode } = req.body;

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({ success: false, error: 'Missing email/password' });
    }
    if (!isNonEmptyString(name)) {
      return res.status(400).json({ success: false, error: 'Missing name' });
    }

    const emailRedirectTo = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback`;

    const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseServiceKey || supabaseAnonKey,
      },
      body: JSON.stringify({
        email,
        password,
        data: { name },
        options: { emailRedirectTo },
      }),
    });

    const payloadText = await response.text();
    const payload = payloadText ? JSON.parse(payloadText) : {};

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: payload?.msg || payload?.error_description || 'Sign up failed',
        details: payload,
      });
    }

    // Referral handling (best-effort; trigger may create users row slightly later)
    if (referralCode && isNonEmptyString(referralCode) && payload?.user?.id) {
      const newUserId = payload.user.id;

      // Retry because trigger may take a moment
      for (let i = 0; i < 5; i++) {
        const referrer = await supabase
          .from('users')
          .select('id')
          .eq('referral_code', referralCode)
          .maybeSingle();

        if (referrer?.error) throw referrer.error;

        if (referrer?.data?.id) {
          await supabase
            .from('users')
            .update({ referred_by: referrer.data.id })
            .eq('id', newUserId);
          break;
        }

        await new Promise((r) => setTimeout(r, 700));
      }
    }

    res.json({ success: true, data: payload });
  } catch (err) {
    console.error('Auth sign-up error:', err);
    res.status(500).json({ success: false, error: 'Sign up failed', details: err?.message || String(err) });
  }
});

app.post('/api/auth/sign-in', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({ success: false, error: 'Missing email/password' });
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseServiceKey || supabaseAnonKey,
      },
      body: JSON.stringify({ email, password }),
    });

    const payloadText = await response.text();
    const payload = payloadText ? JSON.parse(payloadText) : {};

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: payload?.error_description || payload?.msg || 'Sign in failed',
        details: payload,
      });
    }

    res.json({ success: true, data: payload });
  } catch (err) {
    console.error('Auth sign-in error:', err);
    res.status(500).json({ success: false, error: 'Sign in failed', details: err?.message || String(err) });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!isNonEmptyString(refreshToken)) {
      return res.status(400).json({ success: false, error: 'Missing refreshToken' });
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseServiceKey || supabaseAnonKey,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    const payloadText = await response.text();
    const payload = payloadText ? JSON.parse(payloadText) : {};

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: payload?.error_description || payload?.msg || 'Refresh failed',
        details: payload,
      });
    }

    res.json({ success: true, data: payload });
  } catch (err) {
    console.error('Auth refresh error:', err);
    res.status(500).json({ success: false, error: 'Refresh failed', details: err?.message || String(err) });
  }
});

app.post('/api/auth/me', async (req, res) => {
  // Optional convenience endpoint that uses Authorization header.
  // Frontend can call POST /api/auth/me, or can use GET with auth header.
  try {
    const accessToken = getBearerToken(req);
    if (!accessToken) {
      return res.status(401).json({ success: false, error: 'Missing Authorization Bearer token' });
    }

    const { appUser } = await getAuthedAppUser(accessToken);
    res.json({ success: true, data: appUser });
  } catch (err) {
    console.error('Auth/me error:', err);
    const status = err?.status || 401;
    res.status(status).json({ success: false, error: err?.message || 'Unauthorized' });
  }
});

app.get('/api/debug/auth/me', async (req, res) => {
  try {
    const accessToken = getBearerToken(req);
    if (!accessToken) {
      return res.status(401).json({ success: false, error: 'Missing Authorization Bearer token' });
    }

    const authUser = await fetchSupabaseAuthedUser(accessToken);
    const userId = authUser?.id || authUser?.sub;

    const { data: appUser, error: appUserErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (appUserErr) {
      return res.json({ success: false, stage: 'select_users', error: appUserErr.message || String(appUserErr), authUser });
    }

    if (appUser) {
      return res.json({ success: true, stage: 'found_users', authUser, appUser });
    }

    const nameFromMetadata =
      authUser?.user_metadata?.name ||
      authUser?.user_metadata?.full_name ||
      authUser?.app_metadata?.name ||
      null;

    const insertPayload = {
      id: userId,
      email: authUser?.email || null,
      name: nameFromMetadata || (authUser?.email ? String(authUser.email).split('@')[0] : 'User'),
      role: 'student',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: created, error: createErr } = await supabase
      .from('users')
      .insert(insertPayload)
      .select('*')
      .maybeSingle();

    if (createErr) {
      return res.json({
        success: false,
        stage: 'auto_provision_insert',
        error: createErr.message || String(createErr),
        insertPayload,
        authUser,
      });
    }

    if (!created) {
      return res.json({
        success: false,
        stage: 'auto_provision_insert_no_row',
        authUser,
        insertPayload,
      });
    }

    return res.json({ success: true, stage: 'auto_provision_insert_ok', authUser, appUser: created });
  } catch (err) {
    return res.status(500).json({
      success: false,
      stage: 'unexpected_error',
      error: err?.message || String(err),
    });
  }
});

// ------------ Users / Profile ------------

app.get('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'User not found' });

    res.json({ success: true, data });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch user', details: err?.message || String(err) });
  }
});

app.patch('/api/users/me', async (req, res) => {
  const authResult = await requireAuth(req, res);
  if (!authResult || authResult.success === false) return;

  try {
    const { appUser } = authResult;
    const updates = req.body || {};

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', appUser.id)
      .select('*')
      .maybeSingle();

    if (error) throw error;

    // Update local appUser state
    res.json({ success: true, data });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, error: 'Failed to update profile', details: err?.message || String(err) });
  }
});

// ------------ Listings ------------

app.get('/api/listings', async (req, res) => {
  try {
    const { category, search, userId } = req.query;

    let query = supabase
      .from('listings')
      .select(`
        *,
        user:users(*)
      `)
      .eq('status', 'active')
      .order('is_boosted', { ascending: false })
      .order('created_at', { ascending: false });

    if (typeof category === 'string' && category.trim()) {
      query = query.eq('category', String(category).toLowerCase());
    }

    if (typeof userId === 'string' && userId.trim()) {
      query = query.eq('user_id', userId);
    }

    if (typeof search === 'string' && search.trim()) {
      const s = String(search).trim();
      query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const now = nowIso();
    const processed = (data || []).map((listing) => ({
      ...listing,
      is_boosted: listing.is_boosted && listing.boost_expires_at && listing.boost_expires_at > now,
    }));

    res.json({ success: true, data: processed });
  } catch (err) {
    console.error('Get listings error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch listings', details: err?.message || String(err) });
  }
});

app.get('/api/listings/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { data, error } = await supabase
      .from('listings')
      .select(`
        *,
        user:users(*)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Listing not found' });

    // Refresh boost expiry
    if (data.is_boosted && data.boost_expires_at && data.boost_expires_at <= nowIso()) {
      data.is_boosted = false;
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error('Get listing error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch listing', details: err?.message || String(err) });
  }
});

app.post('/api/listings', async (req, res) => {
  const authResult = await requireAuth(req, res);
  if (!authResult || authResult.success === false) return;

  try {
    const { appUser } = authResult;
    const { title, description, price, category, condition, images = [] } = req.body || {};

    if (!isNonEmptyString(title) || !isNonEmptyString(description) || !isNonEmptyString(category)) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const p = normalizePriceInput(price);
    if (p === null || p < 0) return res.status(400).json({ success: false, error: 'Invalid price' });

    // Determine listing fee logic like frontend
    const isFirstListing = !appUser.free_listing_used;
    const listingFeeAmount = isFirstListing ? 0 : 0; // PRICING.LISTING.SUBSEQUENT is 0 in current frontend constants
    const listingFeePaid = !isFirstListing;

    const { data, error } = await supabase
      .from('listings')
      .insert({
        title,
        description,
        price: p,
        category: String(category).toLowerCase(),
        condition: condition || null,
        images,
        user_id: appUser.id,
        listing_fee_paid: listingFeePaid,
        listing_fee_amount: listingFeeAmount,
      })
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(500).json({ success: false, error: 'Failed to create listing' });

    // Update user's listing count
    await supabase
      .from('users')
      .update({
        free_listing_used: true,
        listings_count: (Number(appUser.listings_count || 0) || 0) + 1,
      })
      .eq('id', appUser.id);

    res.json({ success: true, data });
  } catch (err) {
    console.error('Create listing error:', err);
    res.status(500).json({ success: false, error: 'Failed to create listing', details: err?.message || String(err) });
  }
});

app.patch('/api/listings/:id', async (req, res) => {
  const authResult = await requireAuth(req, res);
  if (!authResult || authResult.success === false) return;

  try {
    const { appUser } = authResult;
    const id = req.params.id;

    const { data, error } = await supabase
      .from('listings')
      .update(req.body || {})
      .eq('id', id)
      .eq('user_id', appUser.id)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error('Update listing error:', err);
    res.status(500).json({ success: false, error: 'Failed to update listing', details: err?.message || String(err) });
  }
});

app.post('/api/listings/:id/delete', async (req, res) => {
  const authResult = await requireAuth(req, res);
  if (!authResult || authResult.success === false) return;

  try {
    const { appUser } = authResult;
    const id = req.params.id;

    const { error } = await supabase
      .from('listings')
      .update({ status: 'deleted' })
      .eq('id', id)
      .eq('user_id', appUser.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Delete listing error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete listing', details: err?.message || String(err) });
  }
});

app.post('/api/listings/:id/boost', async (req, res) => {
  const authResult = await requireAuth(req, res);
  if (!authResult || authResult.success === false) return;

  try {
    const { appUser } = authResult;
    const listingId = req.params.id;
    const { boostType } = req.body || {};

    const boostPrices = {
      featured: { amount: 500, hours: 48 },
      urgent: { amount: 300, hours: 24 },
      premium: { amount: 1000, hours: 72 },
    };

    if (!boostType || !boostPrices[boostType]) {
      return res.status(400).json({ success: false, error: 'Invalid boostType' });
    }

    const boost = boostPrices[boostType];
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + boost.hours);

    const { data: boostData, error: boostError } = await supabase
      .from('boosts')
      .insert({
        listing_id: listingId,
        user_id: appUser.id,
        type: boostType,
        amount: boost.amount,
        duration_hours: boost.hours,
        expires_at: expiresAt.toISOString(),
      })
      .select('*')
      .maybeSingle();

    if (boostError) throw boostError;

    const { data: listing, error } = await supabase
      .from('listings')
      .update({
        is_boosted: true,
        boost_type: boostType,
        boost_expires_at: expiresAt.toISOString(),
      })
      .eq('id', listingId)
      .select('*')
      .maybeSingle();

    if (error) throw error;

    res.json({ success: true, data: listing, boostData });
  } catch (err) {
    console.error('Boost listing error:', err);
    res.status(500).json({ success: false, error: 'Failed to boost listing', details: err?.message || String(err) });
  }
});

// ------------ Vendors ------------

app.get('/api/vendors', async (req, res) => {
  try {
    const { featured, category, verified } = req.query;

    let query = supabase
      .from('vendors')
      .select(`
        *,
        user:users(*)
      `)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false });

    if (typeof featured === 'string') query = query.eq('is_featured', featured === 'true');
    if (typeof verified === 'string') query = query.eq('is_verified', verified === 'true');
    if (typeof category === 'string' && category.trim()) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw error;

    const now = nowIso();
    const processed = (data || []).map((vendor) => ({
      ...vendor,
      is_featured: vendor.is_featured && vendor.featured_expires_at && vendor.featured_expires_at > now,
    }));

    res.json({ success: true, data: processed });
  } catch (err) {
    console.error('Get vendors error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch vendors', details: err?.message || String(err) });
  }
});

app.get('/api/vendors/:id', async (req, res) => {
  try {
    const id = req.params.id;

    const { data, error } = await supabase
      .from('vendors')
      .select(`
        *,
        user:users(*)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error('Get vendor error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch vendor', details: err?.message || String(err) });
  }
});

app.get('/api/vendors/by-user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    const { data, error } = await supabase
      .from('vendors')
      .select(`
        *,
        user:users(*)
      `)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error('Get vendor by user error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch vendor profile', details: err?.message || String(err) });
  }
});

app.post('/api/vendors', async (req, res) => {
  const authResult = await requireAuth(req, res);
  if (!authResult || authResult.success === false) return;

  try {
    const { appUser } = authResult;
    const {
      business_name,
      business_description,
      category,
      contact_email,
      contact_phone,
      business_address,
      business_logo,
    } = req.body || {};

    const { data, error } = await supabase
      .from('vendors')
      .insert({
        user_id: appUser.id,
        business_name,
        business_description: business_description || null,
        category,
        contact_email: contact_email || null,
        contact_phone: contact_phone || null,
        business_address: business_address || null,
        business_logo: business_logo || null,
      })
      .select('*')
      .maybeSingle();

    if (error) throw error;

    await supabase
      .from('users')
      .update({ role: 'vendor' })
      .eq('id', appUser.id);

    res.json({ success: true, data });
  } catch (err) {
    console.error('Create vendor error:', err);
    res.status(500).json({ success: false, error: 'Failed to create vendor', details: err?.message || String(err) });
  }
});

app.patch('/api/vendors/:id', async (req, res) => {
  const authResult = await requireAuth(req, res);
  if (!authResult || authResult.success === false) return;

  try {
    const { appUser } = authResult;
    const id = req.params.id;

    // Ensure vendor belongs to user
    const { data: vendorRow } = await supabase
      .from('vendors')
      .select('id,user_id')
      .eq('id', id)
      .maybeSingle();

    if (!vendorRow || vendorRow.user_id !== appUser.id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const { data, error } = await supabase
      .from('vendors')
      .update(req.body || {})
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error('Update vendor error:', err);
    res.status(500).json({ success: false, error: 'Failed to update vendor', details: err?.message || String(err) });
  }
});

app.post('/api/vendors/:id/feature', async (req, res) => {
  const authResult = await requireAuth(req, res);
  if (!authResult || authResult.success === false) return;

  try {
    const { appUser } = authResult;
    const id = req.params.id;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data, error } = await supabase
      .from('vendors')
      .update({
        is_featured: true,
        featured_expires_at: expiresAt.toISOString(),
      })
      .eq('id', id)
      .eq('user_id', appUser.id)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error('Feature vendor error:', err);
    res.status(500).json({ success: false, error: 'Failed to feature vendor', details: err?.message || String(err) });
  }
});

app.post('/api/vendors/:id/verify', async (req, res) => {
  // If your current UI uses vendor verify after payment, keep it here.
  const authResult = await requireAuth(req, res);
  if (!authResult || authResult.success === false) return;

  try {
    const { appUser } = authResult;
    const id = req.params.id;

    const { data, error } = await supabase
      .from('vendors')
      .update({
        is_verified: true,
        verification_fee_paid: true,
        verification_paid_at: nowIso(),
      })
      .eq('id', id)
      .eq('user_id', appUser.id)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error('Verify vendor error:', err);
    res.status(500).json({ success: false, error: 'Failed to verify vendor', details: err?.message || String(err) });
  }
});

// ------------ Wallet ------------

app.get('/api/wallet/transactions', async (req, res) => {
  const authResult = await requireAuth(req, res);
  if (!authResult || authResult.success === false) return;

  try {
    const { appUser } = authResult;

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', appUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('Wallet transactions error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch transactions', details: err?.message || String(err) });
  }
});

app.get('/api/wallet/balance', async (req, res) => {
  const authResult = await requireAuth(req, res);
  if (!authResult || authResult.success === false) return;

  try {
    const { appUser } = authResult;

    const { data, error } = await supabase
      .from('users')
      .select('wallet_balance, total_spent, total_cashback_earned')
      .eq('id', appUser.id)
      .maybeSingle();

    if (error) throw error;

    res.json({ success: true, data: data || null });
  } catch (err) {
    console.error('Wallet balance error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch balance', details: err?.message || String(err) });
  }
});

// ------------ Notifications ------------

app.get('/api/notifications', async (req, res) => {
  const authResult = await requireAuth(req, res);
  if (!authResult || authResult.success === false) return;

  try {
    const { appUser } = authResult;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', appUser.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications', details: err?.message || String(err) });
  }
});

app.post('/api/notifications/read', async (req, res) => {
  const authResult = await requireAuth(req, res);
  if (!authResult || authResult.success === false) return;

  try {
    const { appUser } = authResult;
    const { notificationId } = req.body || {};

    if (notificationId && isNonEmptyString(notificationId)) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', appUser.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', appUser.id)
        .eq('is_read', false);

      if (error) throw error;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Mark notifications read error:', err);
    res.status(500).json({ success: false, error: 'Failed to mark notifications as read', details: err?.message || String(err) });
  }
});

app.delete('/api/notifications/:id', async (req, res) => {
  const authResult = await requireAuth(req, res);
  if (!authResult || authResult.success === false) return;

  try {
    const { appUser } = authResult;
    const id = req.params.id;

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', appUser.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete notification', details: err?.message || String(err) });
  }
});

// ------------ Chats / Messages ------------

app.get('/api/chats', async (req, res) => {
  const authResult = await requireAuth(req, res);
  if (!authResult || authResult.success === false) return;

  try {
    const { appUser } = authResult;

    const { data, error } = await supabase
      .from('chats')
      .select(`
        *,
        buyer:users!chats_buyer_id_fkey(*),
        seller:users!chats_seller_id_fkey(*),
        listing:listings(title, images, price)
      `)
      .or(`buyer_id.eq.${appUser.id},seller_id.eq.${appUser.id}`)
      .order('last_message_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('Get chats error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch chats', details: err?.message || String(err) });
  }
});

app.get('/api/chats/:chatId/messages', async (req, res) => {
  const authResult = await requireAuth(req, res);
  if (!authResult || authResult.success === false) return;

  try {
    const { appUser } = authResult;
    const chatId = req.params.chatId;

    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users(*)
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Authorization is handled by RLS; but still keep it consistent
    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch messages', details: err?.message || String(err) });
  }
});

app.post('/api/chats/start', async (req, res) => {
  const authResult = await requireAuth(req, res);
  if (!authResult || authResult.success === false) return;

  try {
    const { appUser } = authResult;
    const { listingId, sellerId } = req.body || {};

    if (!isNonEmptyString(listingId) || !isNonEmptyString(sellerId)) {
      return res.status(400).json({ success: false, error: 'Missing listingId/sellerId' });
    }

    // Check existing chat
    const { data: existingChat, error: existingErr } = await supabase
      .from('chats')
      .select('*')
      .eq('listing_id', listingId)
      .eq('buyer_id', appUser.id)
      .eq('seller_id', sellerId)
      .maybeSingle();

    if (existingErr) throw existingErr;

    if (existingChat) {
      return res.json({ success: true, data: existingChat });
    }

    const { data: created, error: createErr } = await supabase
      .from('chats')
      .insert({
        listing_id: listingId,
        buyer_id: appUser.id,
        seller_id: sellerId,
      })
      .select('*')
      .maybeSingle();

    if (createErr) throw createErr;
    res.json({ success: true, data: created });
  } catch (err) {
    console.error('Start chat error:', err);
    res.status(500).json({ success: false, error: 'Failed to start chat', details: err?.message || String(err) });
  }
});

app.post('/api/chats/:chatId/messages', async (req, res) => {
  const authResult = await requireAuth(req, res);
  if (!authResult || authResult.success === false) return;

  try {
    const { appUser } = authResult;
    const chatId = req.params.chatId;
    const { content } = req.body || {};
    if (!isNonEmptyString(content)) {
      return res.status(400).json({ success: false, error: 'Missing content' });
    }

    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: appUser.id,
        content,
      })
      .select('*')
      .maybeSingle();

    if (msgError) throw msgError;
    if (!message) return res.status(500).json({ success: false, error: 'Failed to send message' });

    // Update chat unread counts + last_message
    const { data: chatRow, error: chatErr } = await supabase
      .from('chats')
      .select('buyer_id, seller_id, buyer_unread, seller_unread')
      .eq('id', chatId)
      .maybeSingle();

    if (chatErr) throw chatErr;

    const isBuyer = chatRow.buyer_id === appUser.id;
    const updateData = {
      last_message: content,
      last_message_at: nowIso(),
    };

    updateData[isBuyer ? 'seller_unread' : 'buyer_unread'] =
      (isBuyer ? (chatRow.seller_unread || 0) : (chatRow.buyer_unread || 0)) + 1;

    await supabase
      .from('chats')
      .update(updateData)
      .eq('id', chatId);

    res.json({ success: true, data: message });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ success: false, error: 'Failed to send message', details: err?.message || String(err) });
  }
});

app.post('/api/chats/:chatId/read', async (req, res) => {
  const authResult = await requireAuth(req, res);
  if (!authResult || authResult.success === false) return;

  try {
    const { appUser } = authResult;
    const chatId = req.params.chatId;

    const { data: chatRow, error: chatErr } = await supabase
      .from('chats')
      .select('buyer_id')
      .eq('id', chatId)
      .maybeSingle();

    if (chatErr) throw chatErr;
    if (!chatRow) return res.status(404).json({ success: false, error: 'Chat not found' });

    const isBuyer = chatRow.buyer_id === appUser.id;
    const updateData = {};
    updateData[isBuyer ? 'buyer_unread' : 'seller_unread'] = 0;

    await supabase
      .from('chats')
      .update(updateData)
      .eq('id', chatId);

    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('chat_id', chatId)
      .neq('sender_id', appUser.id)
      .eq('is_read', false);

    res.json({ success: true });
  } catch (err) {
    console.error('Mark chat read error:', err);
    res.status(500).json({ success: false, error: 'Failed to mark as read', details: err?.message || String(err) });
  }
});

// ------------ Admin dashboard ------------

app.get('/api/admin/dashboard', async (req, res) => {
  try {
    const authResult = await requireAuth(req, res);
    if (!authResult || authResult.success === false) return;

    const { appUser } = authResult;
    if (appUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    const { count: vendorCount } = await supabase
      .from('vendors')
      .select('*', { count: 'exact', head: true });

    const { data: revenueData, error: revErr } = await supabase
      .from('transactions')
      .select('amount')
      .eq('status', 'success')
      .not('type', 'in', ['cashback', 'referral_reward', 'refund']);

    if (revErr) throw revErr;

    const { data: cashbackData, error: cbErr } = await supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'cashback');

    if (cbErr) throw cbErr;

    const { count: boostCount } = await supabase
      .from('boosts')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const { count: pendingCount } = await supabase
      .from('vendors')
      .select('*', { count: 'exact', head: true })
      .eq('is_verified', false)
      .eq('verification_fee_paid', true);

    const txDataQuery = supabase
      .from('transactions')
      .select(`
        *,
        user:users(name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    const { data: txData, error: txErr } = await txDataQuery;
    if (txErr) throw txErr;

    const { data: pendingVendorsData, error: pendingErr } = await supabase
      .from('vendors')
      .select(`
        *,
        user:users(name, email)
      `)
      .eq('is_verified', false)
      .eq('verification_fee_paid', true)
      .order('created_at', { ascending: false });

    if (pendingErr) throw pendingErr;

    const { data: recentUsersData, error: recentUsersErr } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentUsersErr) throw recentUsersErr;

    const stats = {
      totalUsers: userCount || 0,
      totalVendors: vendorCount || 0,
      totalRevenue: (revenueData || []).reduce((sum, t) => sum + Number(t.amount || 0), 0),
      totalCashback: (cashbackData || []).reduce((sum, t) => sum + Number(t.amount || 0), 0),
      activeBoosts: boostCount || 0,
      pendingVerifications: pendingCount || 0,
    };

    res.json({
      success: true,
      data: {
        stats,
        transactions: txData || [],
        pendingVendors: pendingVendorsData || [],
        recentUsers: recentUsersData || [],
      },
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to load dashboard',
      details: err?.message || String(err),
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Something went wrong!' });
});

// Start server + WebSocket
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.userId = null;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString('utf8'));

      // Protocol:
      // { type: "auth", token: "<supabase_access_token>" }
      // { type: "subscribe", channel: "notifications" | "messages" }
      if (msg?.type === 'auth') {
        const token = msg?.token;
        if (!isNonEmptyString(token)) {
          ws.send(JSON.stringify({ type: 'auth_ack', success: false }));
          return;
        }

        try {
          const { appUser } = await getAuthedAppUser(token);
          ws.userId = appUser.id;
          ws.send(JSON.stringify({ type: 'auth_ack', success: true }));
        } catch (e) {
          ws.send(JSON.stringify({ type: 'auth_ack', success: false, error: 'Invalid token' }));
        }
        return;
      }

      if (!ws.userId) {
        ws.send(JSON.stringify({ type: 'error', error: 'Not authenticated over WS. Send {type:"auth", token} first.' }));
        return;
      }

      if (msg?.type === 'subscribe') {
        ws.subscriptions = ws.subscriptions || new Set();
        ws.subscriptions.add(msg.channel);
        ws.send(JSON.stringify({ type: 'sub_ack', channel: msg.channel }));
        return;
      }

      ws.send(JSON.stringify({ type: 'error', error: 'Unknown message type' }));
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON payload' }));
    }
  });
});

// basic keep-alive
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

server.listen(PORT, () => {
  console.log(`🚀 HikmahHub Backend API running on port ${PORT}`);
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}/ws`);
});
