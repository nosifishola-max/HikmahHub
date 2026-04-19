# Production Environment Monitoring & Maintenance

## Daily Health Checks

### Frontend (Vercel)
```bash
# Check deployment status
curl https://yourdomain.vercel.app -I
# Should return 200 OK

# Check build logs (via Vercel Dashboard)
# Dashboard → Deployments → Latest
```

### Backend (VPS)
```bash
# SSH into VPS
ssh root@your_vps_ip

# Check Docker status
docker-compose ps
# Should show 'Up' status

# Check resource usage
docker stats

# View recent logs
docker-compose logs --tail=50 backend
```

---

## Weekly Maintenance

### Database Backups
```bash
# Backup Supabase database
mkdir -p ~/backups
pg_dump -h your_supabase_host -U postgres -d postgres \
  > ~/backups/backup-$(date +%Y-%m-%d).sql

# Keep backups for 30 days
find ~/backups -name "backup-*.sql" -mtime +30 -delete
```

### Update Dependencies
```bash
# Check for security updates (locally first)
npm audit

# Update packages
npm update

# Test and commit
git add package.json package-lock.json
git commit -m "chore: update dependencies"
git push origin main
```

---

## Monthly Security Review

### 1. SSL Certificate Status
```bash
# Check certificate expiry
certbot certificates

# Should auto-renew, but verify:
systemctl status certbot.timer
```

### 2. Firewall & Security Groups
- Review VPS firewall rules (allow only 80, 443, 22)
- Check security group rules on cloud provider
- Disable SSH password auth (use keys only)

### 3. Secrets Rotation
- Rotate Paystack API keys
- Update Supabase service role keys
- Review GitHub Actions secrets

### 4. User Access
- Remove unused team members from GitHub
- Audit SSH access logs: `journalctl -u sshd`

---

## Monitoring Alerts Setup

### Option 1: Uptime Monitoring (Free)
```bash
# Using uptimerobot.com
# Monitor: https://api.yourdomain.com/api/health
# Every 5 minutes
# Alert email on failure
```

### Option 2: Error Tracking (Sentry)
```bash
# In backend/server.js, add at top:
const Sentry = require("@sentry/node");
Sentry.init({ dsn: "your_sentry_dsn" });
app.use(Sentry.Handlers.errorHandler());

# npm install @sentry/node
# Set SENTRY_DSN in backend/.env
```

### Option 3: Performance Monitoring
```bash
# Vercel: Automatic analytics dashboard
# Backend: Add simple timing middleware

// In server.js
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  next();
});
```

---

## Performance Optimization

### Frontend (Vercel)
- ✅ Automatic caching of assets
- ✅ CDN enabled by default
- Check: **Analytics → Web Vitals**

### Backend (Express)
```javascript
// Add caching headers in server.js
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});
```

### Database (Supabase)
- Enable query caching
- Add indexes on frequently searched fields
- Monitor slow queries in dashboard

---

## Troubleshooting Guide

### Backend not responding
```bash
# 1. Check container status
docker-compose ps

# 2. View logs
docker-compose logs backend

# 3. Check resource usage
docker stats

# 4. Restart if needed
docker-compose restart backend

# 5. Check health endpoint
curl https://api.yourdomain.com/api/health
```

### High CPU/Memory Usage
```bash
# Identify process using resources
top
ps aux | grep node

# Check for memory leaks
docker-compose logs backend | grep -i "memory"

# Restart container
docker-compose restart backend

# Consider: Add resource limits in docker-compose.yml
```

### Database Connection Issues
```bash
# Test connection
curl https://api.yourdomain.com/api/supabase/test

# Check credentials in backend/.env
docker-compose exec backend env | grep SUPABASE

# Verify Supabase status
# https://status.supabase.io
```

### SSL Certificate Expired
```bash
# Check expiry
certbot certificates

# Renew (automatic, but manual if needed)
certbot renew

# Check expiry with openssl
echo | openssl s_client -servername api.yourdomain.com \
  -connect api.yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates
```

### Too Many Requests (Rate Limiting)
```bash
# In production, consider rate limiting:
npm install express-rate-limit

// Add to server.js
const rateLimit = require("express-rate-limit");
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);
```

---

## Scaling Guidelines

### When to Scale (Metrics)
- Response time > 500ms consistently
- CPU usage > 70% for 1+ hour
- Database query times > 2 seconds
- Error rate > 1%

### Scaling Steps
1. **Upgrade VPS**: 2x CPU and RAM
2. **Add caching**: Redis for hot data
3. **Database optimization**: Better indexes
4. **Load balancer**: Multiple backend instances
5. **CDN**: CloudFlare for static assets

---

## Disaster Recovery

### Recovery Time Objectives (RTO)
- Frontend: < 5 minutes (Vercel auto-recovery)
- Backend: < 15 minutes (docker-compose restart)
- Database: < 1 hour (Supabase automated backups)

### Recovery Procedures

#### Backend Down
```bash
# 1. SSH into VPS
ssh root@your_vps_ip

# 2. Restart services
docker-compose restart backend

# 3. Verify health
curl https://api.yourdomain.com/api/health

# 4. Check logs
docker-compose logs backend
```

#### Database Down
```bash
# Contact Supabase support immediately
# Check: https://status.supabase.io

# In the meantime:
# - Frontend can still load (use cached data)
# - Backend returns maintenance message

# Recovery:
# - Supabase restores from automated backup
# - Sync any lost data from backup
```

#### VPS Down
```bash
# 1. Contact hosting provider
# 2. Spin up new VPS instance
# 3. Clone repository
# 4. Set up Docker Compose
# 5. Deploy latest code
# 6. Update DNS to new IP
```

---

## Budget Monitoring

### Monthly Costs
- **Vercel Frontend**: Free - $50/mo
- **VPS (2GB RAM)**: $10 - $20/mo
- **Supabase**: Free - $100/mo
- **Domain**: $10/year
- **SSL**: Free (Let's Encrypt)
- **Total**: ~$20-40/mo

### Cost Optimization
- Use Vercel free tier while possible
- Monitor Supabase storage and bandwidth
- Right-size VPS for actual usage
- Use spot instances if using AWS

---

## Incident Response

### Response Steps
1. **Detect**: Monitor alerts (uptime, errors, performance)
2. **Assess**: Check which component is affected
3. **Communicate**: Notify users if customer-facing
4. **Fix**: Refer to troubleshooting guide above
5. **Verify**: Test all endpoints
6. **Document**: Record what happened and why
7. **Prevent**: Make changes to prevent recurrence

### Incident Log Template
```
Date: YYYY-MM-DD HH:MM UTC
Component: [Frontend/Backend/Database]
Duration: HH:MM
Impact: [User Impact]
Root Cause: [What happened]
Resolution: [What we did]
Prevention: [What we'll do differently]
```

---

## Useful Commands Cheatsheet

```bash
# SSH into VPS
ssh root@your_vps_ip

# View Docker logs
docker-compose logs -f backend
docker-compose logs backend --tail=100

# Check Docker status
docker-compose ps
docker-compose ps -a

# Restart services
docker-compose restart
docker-compose restart backend

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Remove old images
docker image prune

# Database backup
pg_dump -h host -U user -d db > backup.sql

# Certificate renewal
certbot renew
certbot renew --force-renewal

# Check disk space
df -h

# Check memory
free -h

# Check active connections
netstat -tnap | grep ESTABLISHED

# View system logs
journalctl -xe
journalctl -u docker -n 100

# Install updates
apt update && apt upgrade -y

# Reboot (if needed)
reboot
```

---

## Contact Information

- **VPS Provider Support**: [Your provider portal]
- **Vercel Support**: https://vercel.com/support
- **Supabase Support**: https://supabase.com/support
- **Domain Registrar**: [Your registrar]
- **Your Team**: [Your contact info]

---

**Last Updated**: April 2024
**Next Review**: May 2024
