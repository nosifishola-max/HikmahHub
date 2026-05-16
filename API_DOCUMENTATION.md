# HikmahHub Campus Marketplace - API Documentation

**Version:** 1.0.0  
**Status:** Production Ready ✅  
**Base URL:** `https://api.hikmahub.com` (Production) | `http://localhost:3001` (Development)

---

## Table of Contents
1. [Authentication](#authentication)
2. [Health & Debug](#health--debug)
3. [Auth Endpoints](#auth-endpoints)
4. [Users & Profile](#users--profile)
5. [Listings](#listings)
6. [Vendors](#vendors)
7. [Payments](#payments)
8. [Wallet](#wallet)
9. [Notifications](#notifications)
10. [Chat & Messages](#chat--messages)
11. [Admin Dashboard](#admin-dashboard)
12. [WebSocket API](#websocket-api)
13. [Error Handling](#error-handling)

---

## Authentication

All endpoints (except `/api/health` and `/api/auth/*`) require Bearer token in the `Authorization` header:

```
Authorization: Bearer <supabase_access_token>
```

**Token Validation:** The server validates tokens against Supabase GoTrue endpoint.

---

## Health & Debug

### GET `/api/health`
Health check endpoint. No authentication required.

**Response:**
```json
{
  "success": true,
  "message": "HikmahHub Backend API is running",
  "timestamp": "2026-04-30T12:00:00.000Z"
}
```

### GET `/api/supabase/test`
Test Supabase connection. No authentication required.

**Response:**
```json
{
  "success": true,
  "message": "Supabase connection successful",
  "data": {
    "connection": "OK",
    "timestamp": "2026-04-30T12:00:00.000Z",
    "supabaseUrl": "Configured"
  }
}
```

---

## Auth Endpoints

### POST `/api/auth/sign-up`
Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe",
  "referralCode": "optional_referral_code"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "user@example.com" },
    "session": { "access_token": "...", "refresh_token": "..." }
  }
}
```

**Status Codes:** `200` Success | `400` Missing fields | `500` Server error

---

### POST `/api/auth/sign-in`
Authenticate existing user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "access_token": "...",
    "refresh_token": "...",
    "user": { "id": "uuid", "email": "user@example.com" }
  }
}
```

---

### POST `/api/auth/refresh`
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "...",
    "refresh_token": "..."
  }
}
```

---

### POST `/api/auth/me`
Get authenticated user profile.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "wallet_balance": 0,
    "listings_count": 0,
    "referral_code": "xyz123"
  }
}
```

---

## Users & Profile

### GET `/api/users/:id`
Get user profile by ID. No authentication required.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "John Doe",
    "email": "user@example.com",
    "avatar_url": "https://...",
    "bio": "Student at...",
    "ratings": 4.8,
    "listings_count": 5
  }
}
```

---

### PATCH `/api/users/me`
Update authenticated user profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Updated Name",
  "bio": "New bio",
  "avatar_url": "https://..."
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* updated user object */ }
}
```

---

## Listings

### GET `/api/listings`
Get all active listings with filters.

**Query Parameters:**
- `category` - Filter by category (string)
- `search` - Search in title/description
- `userId` - Filter by user

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Laptop for Sale",
      "description": "MacBook Pro 2021",
      "price": 500000,
      "category": "electronics",
      "condition": "excellent",
      "images": ["url1", "url2"],
      "is_boosted": true,
      "boost_type": "featured",
      "user_id": "uuid",
      "created_at": "2026-04-30T...",
      "user": { /* seller info */ }
    }
  ]
}
```

---

### GET `/api/listings/:id`
Get single listing details.

**Response:**
```json
{
  "success": true,
  "data": { /* listing object */ }
}
```

---

### POST `/api/listings`
Create new listing.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "iPhone 13",
  "description": "Mint condition, 128GB",
  "price": 250000,
  "category": "electronics",
  "condition": "excellent",
  "images": ["url1", "url2"]
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* created listing */ }
}
```

**Status Codes:** `200` Created | `400` Invalid data | `401` Unauthorized

---

### PATCH `/api/listings/:id`
Update listing (owner only).

**Headers:** `Authorization: Bearer <token>`

**Request Body:** Any listing fields to update

---

### POST `/api/listings/:id/delete`
Soft delete listing.

**Headers:** `Authorization: Bearer <token>`

---

### POST `/api/listings/:id/boost`
Boost a listing for visibility.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "boostType": "featured" | "urgent" | "premium"
}
```

**Boost Types:**
- `featured`: ₦500 for 48 hours
- `urgent`: ₦300 for 24 hours
- `premium`: ₦1000 for 72 hours

**Response:**
```json
{
  "success": true,
  "data": { /* boosted listing */ },
  "boostData": { /* boost record */ }
}
```

---

## Vendors

### GET `/api/vendors`
Get all vendors with filters.

**Query Parameters:**
- `featured` - Filter featured vendors (true/false)
- `verified` - Filter verified vendors
- `category` - Filter by category

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "business_name": "Tech Store",
      "business_description": "...",
      "category": "electronics",
      "is_verified": true,
      "is_featured": true,
      "ratings": 4.9,
      "user": { /* vendor user info */ }
    }
  ]
}
```

---

### GET `/api/vendors/:id`
Get single vendor details.

---

### GET `/api/vendors/by-user/:userId`
Get vendor profile by user ID.

---

### POST `/api/vendors`
Create vendor profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "business_name": "My Store",
  "business_description": "Selling quality products",
  "category": "electronics",
  "contact_email": "store@example.com",
  "contact_phone": "+234-...",
  "business_address": "Lagos, Nigeria",
  "business_logo": "url"
}
```

---

### PATCH `/api/vendors/:id`
Update vendor profile (owner only).

**Headers:** `Authorization: Bearer <token>`

---

### POST `/api/vendors/:id/feature`
Feature vendor for 7 days.

**Headers:** `Authorization: Bearer <token>`

**Cost:** Deducted from wallet

---

### POST `/api/vendors/:id/verify`
Verify vendor after payment.

**Headers:** `Authorization: Bearer <token>`

---

## Payments

### POST `/api/paystack/initialize`
Initialize Paystack payment.

**Request Body:**
```json
{
  "email": "user@example.com",
  "amount": 500,
  "type": "listing" | "vendor_feature" | "vendor_verify" | "wallet_topup",
  "metadata": {},
  "boostType": "featured" | "urgent" | "premium" // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "authorization_url": "https://checkout.paystack.com/...",
    "access_code": "...",
    "reference": "HH1719775200000"
  }
}
```

---

### GET `/api/paystack/verify/:reference`
Verify payment status.

**Query Parameter:**
- `reference` - Paystack transaction reference

**Response:**
```json
{
  "success": true,
  "data": {
    "reference": "HH...",
    "status": "success",
    "amount": 500,
    "customer": { "email": "..." },
    "metadata": { /* payment metadata */ }
  }
}
```

---

## Wallet

### GET `/api/wallet/balance`
Get wallet balance and spending info.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "wallet_balance": 25000,
    "total_spent": 125000,
    "total_cashback_earned": 3500
  }
}
```

---

### GET `/api/wallet/transactions`
Get all wallet transactions.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "payment" | "cashback" | "referral_reward" | "refund",
      "amount": 500,
      "status": "success" | "pending" | "failed",
      "created_at": "2026-04-30T..."
    }
  ]
}
```

---

## Notifications

### GET `/api/notifications`
Get user notifications (last 50).

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "type": "message" | "payment" | "listing_sold" | "offer_received",
      "title": "New message from...",
      "body": "...",
      "is_read": false,
      "created_at": "2026-04-30T..."
    }
  ]
}
```

---

### POST `/api/notifications/read`
Mark notifications as read.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "notificationId": "uuid" // optional; if omitted, marks all as read
}
```

---

### DELETE `/api/notifications/:id`
Delete notification.

**Headers:** `Authorization: Bearer <token>`

---

## Chat & Messages

### GET `/api/chats`
Get user's active chats.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "listing_id": "uuid",
      "buyer_id": "uuid",
      "seller_id": "uuid",
      "last_message": "Are you still selling?",
      "last_message_at": "2026-04-30T...",
      "buyer_unread": 0,
      "seller_unread": 2,
      "buyer": { /* buyer info */ },
      "seller": { /* seller info */ },
      "listing": { "title": "...", "price": 50000 }
    }
  ]
}
```

---

### GET `/api/chats/:chatId/messages`
Get messages from chat.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "chat_id": "uuid",
      "sender_id": "uuid",
      "content": "Hello, are you interested?",
      "is_read": true,
      "created_at": "2026-04-30T...",
      "sender": { /* sender info */ }
    }
  ]
}
```

---

### POST `/api/chats/start`
Start new chat or return existing.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "listingId": "uuid",
  "sellerId": "uuid"
}
```

---

### POST `/api/chats/:chatId/messages`
Send message in chat.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "content": "Your message here"
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* message object */ }
}
```

---

### POST `/api/chats/:chatId/read`
Mark all messages in chat as read.

**Headers:** `Authorization: Bearer <token>`

---

## Admin Dashboard

### GET `/api/admin/dashboard`
Get admin dashboard stats and data. (Admin role required)

**Headers:** `Authorization: Bearer <admin_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalUsers": 245,
      "totalVendors": 32,
      "totalRevenue": 5250000,
      "totalCashback": 125000,
      "activeBoosts": 18,
      "pendingVerifications": 5
    },
    "transactions": [ /* last 20 transactions */ ],
    "pendingVendors": [ /* vendors awaiting verification */ ],
    "recentUsers": [ /* last 10 users */ ]
  }
}
```

---

## WebSocket API

**Endpoint:** `ws://localhost:3001/ws` (Development) | `wss://api.hikmahub.com/ws` (Production)

### Authentication Flow
```json
{ "type": "auth", "token": "<supabase_access_token>" }
```

Server responds:
```json
{ "type": "auth_ack", "success": true }
```

### Subscribe to Channels
```json
{ "type": "subscribe", "channel": "notifications" | "messages" }
```

Server responds:
```json
{ "type": "sub_ack", "channel": "notifications" }
```

### Real-time Updates
Server sends updates to subscribed clients:
```json
{
  "type": "notification",
  "data": { /* notification object */ }
}
```

---

## Error Handling

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional info (optional)"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Bad Request (validation error) |
| `401` | Unauthorized (missing/invalid token) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Not Found |
| `500` | Server Error |

### Common Errors

- **Missing Authorization Bearer token** - Add `Authorization: Bearer <token>` header
- **Invalid auth user payload** - Token validation failed, try refreshing
- **Supabase connection failed** - Check backend `.env` configuration
- **Failed to initialize payment** - Paystack API error, check PAYSTACK_SECRET_KEY

---

## Environment Variables

Required in `backend/.env`:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your_secret_key
SUPABASE_ANON_KEY=your_anon_key

# Server
PORT=3001
FRONTEND_URL=http://localhost:5173

# Paystack
PAYSTACK_SECRET_KEY=your_paystack_secret_key
```

---

## Rate Limiting

Currently not implemented. Recommended for production:
- 100 requests per minute per IP
- 500 requests per hour per user

---

## Security Best Practices

✅ Use HTTPS/WSS in production  
✅ Validate all input on backend  
✅ Use Bearer tokens, never session cookies  
✅ Enable Supabase RLS policies  
✅ Store sensitive data in .env files  
✅ Implement CORS properly  

---

## Support & Deployment

- **Repository:** GitHub (to be configured)
- **Deployment:** Docker + AWS/Vercel
- **Database:** Supabase PostgreSQL
- **Payment:** Paystack (Nigeria)

---

**Last Updated:** April 30, 2026  
**Maintainer:** HikmahHub Dev Team
