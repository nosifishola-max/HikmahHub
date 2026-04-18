# HikmahHub Backend API

Backend API server for the HikmahHub marketplace application.

## Features

- Paystack payment integration (secure backend processing)
- Payment initialization and verification
- CORS support for frontend communication
- Environment-based configuration

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file with your Paystack secret key:
```env
PAYSTACK_SECRET_KEY=your_secret_key_here
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

3. Start the server:
```bash
npm run dev  # Development mode with nodemon
# or
npm start    # Production mode
```

## API Endpoints

### POST /api/paystack/initialize
Initialize a payment with Paystack.

**Request Body:**
```json
{
  "email": "user@example.com",
  "amount": 1000,
  "metadata": {},
  "type": "listing_fee",
  "boostType": "featured"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "authorization_url": "https://checkout.paystack.com/...",
    "access_code": "access_code_here",
    "reference": "HH1234567890"
  }
}
```

### GET /api/paystack/verify/:reference
Verify a payment status.

**Response:**
```json
{
  "success": true,
  "data": {
    "reference": "HH1234567890",
    "status": "success",
    "amount": 1000,
    "customer": {...},
    "metadata": {...}
  }
}
```

### GET /api/health
Health check endpoint.

## Security

- Paystack secret key is stored securely on the backend
- CORS is configured to only allow requests from the frontend
- No sensitive payment data is exposed to the frontend