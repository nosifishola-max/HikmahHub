# HikmahHub Deployment Guide

## Overview
This project consists of:
- **Frontend**: React + Vite (Deploy to Vercel)
- **Backend**: Node.js + Express (Deploy to VPS with Docker)
- **Database**: Supabase (Cloud-hosted PostgreSQL)

---

## 1. Frontend Deployment (Vercel)

### Prerequisites
- Vercel account (free: https://vercel.com)
- GitHub repository connected to Vercel

### Steps

#### 1.1 Connect to Vercel
```bash
# Option A: Link existing Vercel project
vercel link

# Option B: Deploy directly
vercel
```

#### 1.2 Set Environment Variables in Vercel Dashboard
Go to **Settings → Environment Variables** and add:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=https://api.yourdomain.com
```

#### 1.3 Configure Root Directory
- **Root Directory**: `app`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

#### 1.4 Deploy
```bash
vercel --prod
```

**Frontend URL**: `https://yourdomain.vercel.app`

---

## 2. Backend Deployment (Docker + VPS)

### Prerequisites
- VPS with Docker installed (DigitalOcean, Linode, AWS EC2, etc.)
- SSH access to VPS
- Domain name with DNS pointed to VPS IP

### Steps

#### 2.1 Prepare VPS (Ubuntu/Debian)

```bash
# Connect to VPS
ssh root@your_vps_ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Verify installation
docker --version
docker-compose --version
```

#### 2.2 Clone Repository

```bash
# Go to home directory
cd ~

# Clone your repository
git clone https://github.com/yourusername/HikmahHUB.ng.git
cd HikmahHUB.ng

# Create .env file from template
cp backend/.env.example backend/.env

# Edit with your credentials
nano backend/.env
```

#### 2.3 Configure Environment Variables

Edit `backend/.env`:

```env
NODE_ENV=production
PORT=3001
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
PAYSTACK_SECRET_KEY=your_paystack_secret_key
FRONTEND_URL=https://yourdomain.vercel.app
```

#### 2.4 Build and Run with Docker Compose

```bash
# Build and start containers
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop containers
docker-compose down

# Rebuild and restart
docker-compose up -d --build
```

#### 2.5 Setup Nginx Reverse Proxy

```bash
# Install Nginx
apt install nginx -y

# Create config file
sudo nano /etc/nginx/sites-available/hikmah-backend
```

Add this configuration:

```nginx
upstream backend {
    server localhost:3001;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL Certificate (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy to backend
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Compression
    gzip on;
    gzip_types text/plain text/css text/javascript application/json application/javascript;
}
```

Enable the site:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/hikmah-backend /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

#### 2.6 Setup SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get certificate
certbot certonly --standalone -d api.yourdomain.com

# Auto-renew (automatic with certbot)
systemctl enable certbot.timer
```

#### 2.7 Verify Backend is Running

```bash
# Check if backend is accessible
curl https://api.yourdomain.com/api/health

# Should return:
# {"success":true,"message":"HikmahHub Backend API is running","timestamp":"2024-04-19T10:00:00.000Z"}
```

---

## 3. Database Setup (Supabase)

### Prerequisites
- Supabase account (https://supabase.com)
- Project created

### Steps

#### 3.1 Initialize Database Schema

```bash
# In your VPS/local terminal
psql -h your_supabase_host -U postgres -d postgres -f backend/supabase_schema.sql
```

Or via Supabase Dashboard:
1. Go to **SQL Editor** → **New Query**
2. Copy contents of `backend/supabase_schema.sql`
3. Run the query

#### 3.2 Get Connection Credentials

From Supabase Dashboard:
1. Go to **Settings → API**
2. Copy:
   - Project URL → `SUPABASE_URL`
   - Anon (Public) Key → `SUPABASE_ANON_KEY`
   - Service Role Secret → `SUPABASE_SERVICE_ROLE_KEY` (for admin tasks)

---

## 4. Update Frontend API URL

Update `app/src/lib/supabase.ts` or create environment-based API client:

```typescript
// In your API calls, use:
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const response = await fetch(`${API_BASE_URL}/paystack/initialize`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
```

---

## 5. Continuous Deployment (Optional)

### GitHub Actions CI/CD

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: vercel/action@master
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          scope: ${{ secrets.VERCEL_ORG_ID }}

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to VPS
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: root
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd ~/HikmahHUB.ng
            git pull origin main
            docker-compose up -d --build
```

Add secrets to GitHub repository settings.

---

## 6. Monitoring & Maintenance

### Check Backend Health

```bash
# SSH into VPS
ssh root@your_vps_ip

# Check Docker status
docker-compose ps

# View logs
docker-compose logs -f backend

# Check Nginx status
systemctl status nginx

# Check disk space
df -h

# Check memory usage
free -h
```

### Database Backups

```bash
# Backup Supabase database
pg_dump -h your_supabase_host -U postgres -d postgres > backup.sql

# Restore from backup
psql -h your_supabase_host -U postgres -d postgres < backup.sql
```

### Update Backend

```bash
# SSH into VPS
cd ~/HikmahHUB.ng

# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose up -d --build

# View logs to confirm
docker-compose logs -f backend
```

---

## 7. Troubleshooting

### Backend not connecting to Supabase
```bash
# Check environment variables
docker-compose exec backend env | grep SUPABASE

# Test Supabase connection
curl https://api.yourdomain.com/api/supabase/test
```

### SSL Certificate issues
```bash
# Check certificate expiry
certbot certificates

# Renew certificate
certbot renew
```

### Docker container crashing
```bash
# Check logs
docker-compose logs backend

# Rebuild container
docker-compose down
docker-compose up -d --build

# Check resource limits
docker stats
```

---

## 8. Production Checklist

- [ ] All environment variables set correctly
- [ ] SSL certificates configured and auto-renewing
- [ ] Database backups automated
- [ ] Monitoring/alerting setup (optional: Datadog, New Relic)
- [ ] Rate limiting enabled on API
- [ ] CORS properly configured
- [ ] Error logging setup (optional: Sentry)
- [ ] Performance optimized (caching, CDN)
- [ ] Security headers configured
- [ ] Regular security updates applied

---

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f backend`
2. Review configuration in `backend/.env`
3. Test API health: `curl https://api.yourdomain.com/api/health`
4. Check Supabase status: https://status.supabase.io
