-- HikmahHub Supabase Database Schema
-- Campus Marketplace Platform for Al-Hikmah University, Ilorin

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE (extends auth.users)
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    department TEXT,
    level TEXT,
    campus TEXT DEFAULT 'Al-Hikmah University, Ilorin',
    profile_image TEXT,
    role TEXT DEFAULT 'student' CHECK (role IN ('student', 'vendor', 'admin')),
    verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
    
    -- Wallet System
    wallet_balance NUMERIC(12, 2) DEFAULT 0,
    total_spent NUMERIC(12, 2) DEFAULT 0,
    total_cashback_earned NUMERIC(12, 2) DEFAULT 0,
    
    -- Referral System
    referral_code TEXT UNIQUE,
    referred_by UUID REFERENCES users(id),
    referral_earnings NUMERIC(12, 2) DEFAULT 0,
    
    -- Listing tracking
    listings_count INTEGER DEFAULT 0,
    free_listing_used BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LISTINGS TABLE
-- ============================================
CREATE TABLE listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('electronics', 'fashion', 'books', 'services', 'food', 'accommodation', 'others')),
    condition TEXT CHECK (condition IN ('new', 'used', 'like_new')),
    images TEXT[] DEFAULT '{}',
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'reserved', 'inactive', 'deleted')),
    
    -- Boost tracking
    is_boosted BOOLEAN DEFAULT FALSE,
    boost_type TEXT CHECK (boost_type IN ('featured', 'urgent', 'premium')),
    boost_expires_at TIMESTAMPTZ,
    
    -- Listing fee tracking
    listing_fee_paid BOOLEAN DEFAULT FALSE,
    listing_fee_amount NUMERIC(12, 2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BOOSTS TABLE (tracks all boosts)
-- ============================================
CREATE TABLE boosts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('featured', 'urgent', 'premium')),
    amount NUMERIC(12, 2) NOT NULL,
    duration_hours INTEGER NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VENDORS TABLE
-- ============================================
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    business_description TEXT,
    category TEXT NOT NULL,
    contact_email TEXT,
    contact_phone TEXT,
    business_address TEXT,
    business_logo TEXT,
    
    -- Verification
    is_verified BOOLEAN DEFAULT FALSE,
    verification_fee_paid BOOLEAN DEFAULT FALSE,
    verification_paid_at TIMESTAMPTZ,
    
    -- Featured vendor
    is_featured BOOLEAN DEFAULT FALSE,
    featured_expires_at TIMESTAMPTZ,
    
    -- Stats
    total_sales INTEGER DEFAULT 0,
    rating NUMERIC(2, 1) DEFAULT 0,
    reviews_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRANSACTIONS TABLE
-- ============================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
        'listing_fee', 
        'boost_featured', 
        'boost_urgent', 
        'boost_premium',
        'vendor_verification',
        'vendor_featured',
        'wallet_topup',
        'cashback',
        'referral_reward',
        'wallet_payment',
        'refund'
    )),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
    
    -- Paystack fields
    reference TEXT UNIQUE,
    paystack_reference TEXT,
    
    -- Related records
    listing_id UUID REFERENCES listings(id),
    vendor_id UUID REFERENCES vendors(id),
    boost_id UUID REFERENCES boosts(id),
    
    -- Cashback tracking
    cashback_amount NUMERIC(12, 2) DEFAULT 0,
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REFERRALS TABLE
-- ============================================
CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    reward_amount NUMERIC(12, 2) DEFAULT 500,
    
    -- Tracking
    referral_code_used TEXT,
    first_payment_completed BOOLEAN DEFAULT FALSE,
    first_payment_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ============================================
-- CHATS TABLE
-- ============================================
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Last message tracking
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    
    -- Unread counts
    buyer_unread INTEGER DEFAULT 0,
    seller_unread INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(listing_id, buyer_id, seller_id)
);

-- ============================================
-- MESSAGES TABLE
-- ============================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    
    -- Message type
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'offer')),
    
    -- For offers
    offer_amount NUMERIC(12, 2),
    offer_status TEXT CHECK (offer_status IN ('pending', 'accepted', 'declined')),
    
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'payment_success',
        'payment_failed',
        'cashback_received',
        'boost_activated',
        'boost_expired',
        'new_message',
        'listing_sold',
        'vendor_verified',
        'referral_completed',
        'system'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    
    -- Related data
    related_id UUID,
    related_type TEXT,
    
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ANALYTICS TABLE (for admin dashboard)
-- ============================================
CREATE TABLE analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE UNIQUE DEFAULT CURRENT_DATE,
    
    -- Revenue
    total_revenue NUMERIC(12, 2) DEFAULT 0,
    listing_fees_revenue NUMERIC(12, 2) DEFAULT 0,
    boost_revenue NUMERIC(12, 2) DEFAULT 0,
    vendor_revenue NUMERIC(12, 2) DEFAULT 0,
    
    -- Cashback
    total_cashback_given NUMERIC(12, 2) DEFAULT 0,
    
    -- Activity
    active_boosts INTEGER DEFAULT 0,
    new_listings INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    total_transactions INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_listings_user_id ON listings(user_id);
CREATE INDEX idx_listings_category ON listings(category);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_boosted ON listings(is_boosted, boost_expires_at);
CREATE INDEX idx_listings_created_at ON listings(created_at DESC);

CREATE INDEX idx_boosts_listing_id ON boosts(listing_id);
CREATE INDEX idx_boosts_expires_at ON boosts(expires_at);
CREATE INDEX idx_boosts_active ON boosts(is_active, expires_at);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

CREATE INDEX idx_chats_buyer_id ON chats(buyer_id);
CREATE INDEX idx_chats_seller_id ON chats(seller_id);
CREATE INDEX idx_chats_last_message_at ON chats(last_message_at DESC);

CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

CREATE INDEX idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX idx_referrals_status ON referrals(status);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE boosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view other public profiles" ON users
    FOR SELECT USING (true);

-- Listings table policies
CREATE POLICY "Anyone can view active listings" ON listings
    FOR SELECT USING (status = 'active' OR auth.uid() = user_id);

CREATE POLICY "Users can create listings" ON listings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own listings" ON listings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own listings" ON listings
    FOR DELETE USING (auth.uid() = user_id);

-- Boosts table policies
CREATE POLICY "Users can view own boosts" ON boosts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create boosts" ON boosts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Vendors table policies
CREATE POLICY "Anyone can view vendors" ON vendors
    FOR SELECT USING (true);

CREATE POLICY "Users can create own vendor profile" ON vendors
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vendor profile" ON vendors
    FOR UPDATE USING (auth.uid() = user_id);

-- Transactions table policies
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT USING (auth.uid() = user_id);

-- Chats table policies
CREATE POLICY "Users can view own chats" ON chats
    FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can create chats" ON chats
    FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Users can update own chats" ON chats
    FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Messages table policies
CREATE POLICY "Users can view messages in their chats" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chats 
            WHERE chats.id = messages.chat_id 
            AND (chats.buyer_id = auth.uid() OR chats.seller_id = auth.uid())
        )
    );

CREATE POLICY "Users can send messages in their chats" ON messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM chats 
            WHERE chats.id = messages.chat_id 
            AND (chats.buyer_id = auth.uid() OR chats.seller_id = auth.uid())
        )
    );

-- Notifications table policies
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Referrals table policies
CREATE POLICY "Users can view own referrals" ON referrals
    FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_user_id);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate random 8-character code
        new_code := UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 8));
        
        -- Check if code exists
        SELECT EXISTS(SELECT 1 FROM users WHERE referral_code = new_code) INTO code_exists;
        
        EXIT WHEN NOT code_exists;
    END LOOP;
    
    NEW.referral_code := new_code;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_referral_code
    BEFORE INSERT ON users
    FOR EACH ROW
    WHEN (NEW.referral_code IS NULL)
    EXECUTE FUNCTION generate_referral_code();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_listings_updated_at BEFORE UPDATE ON listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user signup (create user profile)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO users (id, email, name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to process cashback
CREATE OR REPLACE FUNCTION process_cashback(
    p_user_id UUID,
    p_transaction_id UUID,
    p_amount NUMERIC
)
RETURNS VOID AS $$
DECLARE
    cashback_amount NUMERIC;
BEGIN
    -- Calculate 5% cashback
    cashback_amount := p_amount * 0.05;
    
    -- Update user wallet
    UPDATE users 
    SET 
        wallet_balance = wallet_balance + cashback_amount,
        total_cashback_earned = total_cashback_earned + cashback_amount
    WHERE id = p_user_id;
    
    -- Create cashback transaction record
    INSERT INTO transactions (
        user_id, 
        amount, 
        type, 
        status,
        metadata
    ) VALUES (
        p_user_id,
        cashback_amount,
        'cashback',
        'success',
        jsonb_build_object('from_transaction_id', p_transaction_id)
    );
    
    -- Create notification
    INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        related_id,
        related_type
    ) VALUES (
        p_user_id,
        'cashback_received',
        'Cashback Received!',
        'You received ₦' || cashback_amount::text || ' cashback from your payment.',
        p_transaction_id,
        'transaction'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process referral reward
CREATE OR REPLACE FUNCTION process_referral_reward(
    p_referred_user_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_referrer_id UUID;
    v_referral_id UUID;
BEGIN
    -- Get referrer info
    SELECT referred_by, id INTO v_referrer_id, v_referral_id
    FROM users
    WHERE id = p_referred_user_id AND referred_by IS NOT NULL;
    
    IF v_referrer_id IS NOT NULL THEN
        -- Check if referral already completed
        IF EXISTS (
            SELECT 1 FROM referrals 
            WHERE referred_user_id = p_referred_user_id 
            AND status = 'completed'
        ) THEN
            RETURN;
        END IF;
        
        -- Credit referrer
        UPDATE users 
        SET 
            wallet_balance = wallet_balance + 500,
            referral_earnings = referral_earnings + 500
        WHERE id = v_referrer_id;
        
        -- Credit referred user
        UPDATE users 
        SET wallet_balance = wallet_balance + 500
        WHERE id = p_referred_user_id;
        
        -- Update or create referral record
        INSERT INTO referrals (
            referrer_id,
            referred_user_id,
            status,
            first_payment_completed,
            first_payment_at,
            completed_at
        ) VALUES (
            v_referrer_id,
            p_referred_user_id,
            'completed',
            TRUE,
            NOW(),
            NOW()
        )
        ON CONFLICT (referred_user_id) DO UPDATE SET
            status = 'completed',
            first_payment_completed = TRUE,
            first_payment_at = NOW(),
            completed_at = NOW();
        
        -- Create referral reward transactions
        INSERT INTO transactions (user_id, amount, type, status, metadata)
        VALUES 
            (v_referrer_id, 500, 'referral_reward', 'success', 
             jsonb_build_object('referred_user_id', p_referred_user_id)),
            (p_referred_user_id, 500, 'referral_reward', 'success',
             jsonb_build_object('referrer_id', v_referrer_id));
        
        -- Create notifications
        INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
        VALUES
            (v_referrer_id, 'referral_completed', 'Referral Reward!', 
             'You earned ₦500 for referring a new user!', v_referral_id, 'referral'),
            (p_referred_user_id, 'referral_completed', 'Welcome Bonus!',
             'You received ₦500 welcome bonus for signing up with a referral!', v_referral_id, 'referral');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- REALTIME SETUP
-- ============================================
-- Enable realtime for messages and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE chats;

-- ============================================
-- STORAGE BUCKETS
-- ============================================
-- Create storage buckets for images
INSERT INTO storage.buckets (id, name, public) VALUES 
    ('listings', 'listings', true),
    ('profiles', 'profiles', true),
    ('vendors', 'vendors', true);

-- Storage policies
CREATE POLICY "Anyone can view listing images" ON storage.objects
    FOR SELECT USING (bucket_id = 'listings');

CREATE POLICY "Authenticated users can upload listing images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'listings' 
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Users can delete own listing images" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'listings' 
        AND auth.uid() = owner
    );

CREATE POLICY "Anyone can view profile images" ON storage.objects
    FOR SELECT USING (bucket_id = 'profiles');

CREATE POLICY "Authenticated users can upload profile images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'profiles' 
        AND auth.role() = 'authenticated'
    );
