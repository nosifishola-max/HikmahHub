const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const users = supabase.schema('YOUR_SCHEMA').from('users')

// Paystack API configuration
const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Paystack payment initialization
app.post('/api/paystack/initialize', async (req, res) => {
  try {
    const {
      email,
      amount,
      metadata = {},
      type,
      boostType
    } = req.body;

    // Generate unique reference
    const reference = `HH${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Prepare Paystack payload
    const paystackPayload = {
      email,
      amount: amount * 100, // Convert to kobo
      reference,
      callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
      metadata: {
        ...metadata,
        custom_fields: [
          {
            display_name: 'Platform',
            variable_name: 'platform',
            value: 'HikmahHub',
          },
          {
            display_name: 'Payment Type',
            variable_name: 'payment_type',
            value: type || 'general',
          }
        ],
      },
    };

    // Add boost type to metadata if provided
    if (boostType) {
      paystackPayload.metadata.custom_fields.push({
        display_name: 'Boost Type',
        variable_name: 'boost_type',
        value: boostType,
      });
    }

    // Initialize payment with Paystack
    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload),
    });

    if (!response.ok) {
      throw new Error('Failed to initialize payment');
    }

    const data = await response.json();

    res.json({
      success: true,
      data: {
        authorization_url: data.data.authorization_url,
        access_code: data.data.access_code,
        reference: data.data.reference,
      }
    });

  } catch (error) {
    console.error('Payment initialization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize payment'
    });
  }
});

// Paystack payment verification
app.get('/api/paystack/verify/:reference', async (req, res) => {
  try {
    const { reference } = req.params;

    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to verify payment');
    }

    const data = await response.json();

    if (data.data.status === 'success') {
      res.json({
        success: true,
        data: {
          reference: data.data.reference,
          status: data.data.status,
          amount: data.data.amount / 100, // Convert from kobo
          customer: data.data.customer,
          metadata: data.data.metadata,
        }
      });
    } else {
      res.json({
        success: false,
        data: {
          reference: data.data.reference,
          status: data.data.status,
        }
      });
    }

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'HikmahHub Backend API is running',
    timestamp: new Date().toISOString()
  });
});

// Supabase connection test endpoint
app.get('/api/supabase/test', async (req, res) => {
  try {
    // Test basic connection by getting server time
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Supabase connection successful',
      data: {
        connection: 'OK',
        timestamp: new Date().toISOString(),
        supabaseUrl: supabaseUrl ? 'Configured' : 'Missing'
      }
    });
  } catch (error) {
    console.error('Supabase connection test error:', error);
    res.status(500).json({
      success: false,
      error: 'Supabase connection failed',
      details: error.message
    });
  }
});

// Get users count endpoint
app.get('/api/supabase/users/count', async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        userCount: count,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Users count error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get users count',
      details: error.message
    });
  }
});

// Get listings count endpoint
app.get('/api/supabase/listings/count', async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        listingCount: count,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Listings count error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get listings count',
      details: error.message
    });
  }
});

// Get recent listings endpoint
app.get('/api/supabase/listings/recent', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('listings')
      .select(`
        id,
        title,
        price,
        category,
        created_at,
        user:users(name)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Recent listings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recent listings',
      details: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(error.stack);
  res.status(500).json({
    success: false,
    error: 'Something went wrong!'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 HikmahHub Backend API running on port ${PORT}`);
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL}`);
});