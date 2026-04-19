# Production Deployment Quick Start

## 🚀 Quick Summary

Your HikmahHub project is now configured for production deployment with:

| Component | Platform | Status |
|-----------|----------|--------|
| **Frontend** | Vercel | ✅ Ready (React + Vite) |
| **Backend** | Docker + VPS | ✅ Ready (Node.js + Express) |
| **Database** | Supabase | ✅ Cloud-hosted |
| **CI/CD** | GitHub Actions | ✅ Automated |

---

## 📋 Before You Deploy

### 1. **Collect Required Credentials**

```
Frontend (Vercel):
□ Vercel Account & Token
□ GitHub repository connected
□ Supabase URL & Anon Key

Backend (VPS):
□ VPS IP address & SSH key
□ Domain name (e.g., api.yourdomain.com)
□ Paystack Secret Key
□ Supabase credentials (same as frontend)

Vercel Environment Variables needed:
□ VITE_SUPABASE_URL
□ VITE_SUPABASE_ANON_KEY
□ VITE_API_URL (pointing to your backend)
```

### 2. **Files Created for Deployment**

| File | Purpose |
|------|---------|
| `DEPLOYMENT.md` | Complete deployment guide |
| `backend/package.json` | Node.js dependencies |
| `backend/.env.example` | Backend environment template |
| `backend/Dockerfile` | Container build config |
| `docker-compose.yml` | Multi-container orchestration |
| `app/vercel.json` | Vercel build config |
| `.github/workflows/deploy.yml` | Auto-deployment pipeline |
| `.dockerignore` | Docker build optimization |

---

## 🎯 Deployment Steps (in order)

### **Step 1: Frontend Setup (5 min)**
```bash
# 1. Go to https://vercel.com/new
# 2. Select your GitHub repo
# 3. Set root directory to: app
# 4. Add environment variables:
#    - VITE_SUPABASE_URL
#    - VITE_SUPABASE_ANON_KEY
#    - VITE_API_URL=https://api.yourdomain.com
# 5. Click Deploy
```

**Result**: Frontend accessible at `https://yourdomain.vercel.app`

---

### **Step 2: Backend Setup (15 min)**
```bash
# SSH into your VPS
ssh root@your_vps_ip

# Navigate to project
cd ~/HikmahHUB.ng

# Update .env file
nano backend/.env

# Add credentials:
# SUPABASE_URL=...
# SUPABASE_ANON_KEY=...
# PAYSTACK_SECRET_KEY=...
# FRONTEND_URL=https://yourdomain.vercel.app

# Start backend
docker-compose up -d --build

# Verify it's running
curl http://localhost:3001/api/health
```

**Result**: Backend running on port 3001

---

### **Step 3: Setup HTTPS & Reverse Proxy (10 min)**
```bash
# Still on VPS...

# Install SSL certificate
apt install certbot python3-certbot-nginx -y
certbot certonly --standalone -d api.yourdomain.com

# Follow deployment guide for Nginx config
# Edit: /etc/nginx/sites-available/hikmah-backend
nano /etc/nginx/sites-available/hikmah-backend

# Enable and test
sudo ln -s /etc/nginx/sites-available/hikmah-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**Result**: Backend accessible at `https://api.yourdomain.com`

---

### **Step 4: Update Frontend API URL**
```bash
# Back on your local machine
cd app

# Update .env
nano .env

# Change VITE_API_URL to:
# VITE_API_URL=https://api.yourdomain.com

# Commit and push
git add .env
git commit -m "Update API URL for production"
git push origin main

# Vercel will auto-redeploy
```

---

### **Step 5: Setup CI/CD (GitHub Actions)**
```bash
# Go to your GitHub repository settings
# Settings → Secrets → New repository secret

# Add these secrets:
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_org_id
VERCEL_PROJECT_ID=your_project_id
VPS_HOST=your_vps_ip
VPS_USER=root
VPS_SSH_KEY=your_ssh_private_key

# Now every push to main will auto-deploy!
```

---

## ✅ Verification Checklist

After deployment, verify everything works:

```bash
# Test frontend
curl https://yourdomain.vercel.app
# Should see HTML

# Test backend health
curl https://api.yourdomain.com/api/health
# Should return: {"success":true,"message":"HikmahHub Backend API is running"...}

# Test Supabase connection
curl https://api.yourdomain.com/api/supabase/test
# Should return: {"success":true,"message":"Supabase connection successful"...}

# Test database access
curl https://api.yourdomain.com/api/supabase/users/count
# Should return: {"success":true,"data":{"userCount":X...}

# Test listings
curl https://api.yourdomain.com/api/supabase/listings/recent
# Should return: {"success":true,"data":[...]...}
```

---

## 🔧 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| **Backend not starting** | Check logs: `docker-compose logs backend` |
| **CORS errors** | Verify `FRONTEND_URL` in backend `.env` matches your domain |
| **SSL certificate issues** | Run: `certbot certificates` and `certbot renew` |
| **Can't connect to Supabase** | Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` |
| **API requests timing out** | Check Nginx config and firewall rules |

---

## 📚 Next Steps

1. **Monitor your deployment**:
   - Set up alerts (Sentry for errors)
   - Monitor performance (Vercel Analytics, New Relic)
   - Track API usage (Paystack Dashboard)

2. **Optimize performance**:
   - Enable caching in Nginx
   - Add CDN for static assets
   - Optimize database queries

3. **Secure your infrastructure**:
   - Enable 2FA on all platforms
   - Rotate SSH keys regularly
   - Update dependencies monthly
   - Set up backups

4. **Scale as needed**:
   - Load balancer if traffic increases
   - Read replicas for database
   - CDN for global access

---

## 📞 Support Resources

- **Vercel Docs**: https://vercel.com/docs
- **Docker Docs**: https://docs.docker.com
- **Supabase Docs**: https://supabase.com/docs
- **Express.js Docs**: https://expressjs.com
- **React/Vite Docs**: https://vitejs.dev

---

## 🎉 You're Ready!

Your HikmahHub marketplace is now ready for production. The deployment pipeline is automated—just push to `main` and everything deploys automatically.

**Good luck! 🚀**
