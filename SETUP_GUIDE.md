# Leafwalk Resort - Complete Setup & Deployment Guide

## 🎯 Overview
Production-ready luxury resort booking platform with:
- ✅ Complete booking system with payments
- ✅ User authentication & dashboard
- ✅ Admin panel with analytics
- ✅ Razorpay payment integration
- ✅ Review system
- ✅ SEO optimized
- ✅ Fully responsive
- ✅ Enterprise security

---

## 📋 Prerequisites
- Node.js 18+ installed
- Supabase account (free tier works)
- Razorpay account (for payments)
- Domain name (optional for production)

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Dependencies
```bash
cd leafwalk-enhanced
npm install
```

### Step 2: Setup Environment Variables
1. Copy `.env.example` to `.env.local`
2. Fill in your credentials (see Configuration section)

### Step 3: Setup Database
1. Go to https://supabase.com
2. Create new project
3. Go to SQL Editor
4. Copy & paste contents of `database/schema.sql`
5. Click Run

### Step 4: Run Development Server
```bash
npm run dev
```
Open http://localhost:3000

---

## ⚙️ Configuration

### 1. Supabase Setup

#### Create Account
1. Go to https://supabase.com/dashboard
2. Create new project
3. Wait for database to initialize (~2 minutes)

#### Get API Keys
1. Go to Project Settings → API
2. Copy:
   - `Project URL` → NEXT_PUBLIC_SUPABASE_URL
   - `anon public` key → NEXT_PUBLIC_SUPABASE_ANON_KEY
   - `service_role` key → SUPABASE_SERVICE_ROLE_KEY

#### Setup Database
1. Go to SQL Editor
2. Paste contents from `database/schema.sql`
3. Click "Run"
4. Verify tables created in Table Editor

#### Create Admin User
```sql
-- In Supabase SQL Editor
-- First, create user via Supabase Auth Dashboard (Authentication → Users → Add User)
-- Then update their role:
UPDATE users 
SET role = 'admin' 
WHERE email = 'your-admin-email@example.com';
```

### 2. Razorpay Setup

#### Create Account
1. Go to https://razorpay.com
2. Sign up and verify your business
3. Go to Settings → API Keys
4. Generate Test Keys (for development)
5. Generate Live Keys (for production)

#### Get Keys
```env
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxx
```

#### Enable Required Features
1. Go to Settings → Payment Methods
2. Enable: Cards, UPI, Netbanking, Wallets
3. Save changes

### 3. Environment Variables

Create `.env.local` in project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Razorpay
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxx

# Site Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_NAME=Leafwalk Resort

# WhatsApp Business (Update with your number)
WHATSAPP_NUMBER=918630227541

# Security
JWT_SECRET=your_super_secret_jwt_key_min_32_characters_long
```

---

## 📦 Production Deployment

### Option 1: Vercel (Recommended - FREE)

#### Prerequisites
- GitHub account
- Vercel account (free)

#### Steps
1. Push code to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/leafwalk-resort.git
git push -u origin main
```

2. Deploy to Vercel:
   - Go to https://vercel.com
   - Click "New Project"
   - Import your GitHub repository
   - Add environment variables (copy from .env.local)
   - Click "Deploy"

3. Done! Your site will be live in ~2 minutes at:
   `https://your-project.vercel.app`

#### Custom Domain
1. Buy domain (Namecheap, GoDaddy, etc.)
2. In Vercel → Settings → Domains
3. Add your domain
4. Update DNS records as shown
5. SSL certificate auto-generated

### Option 2: Traditional Hosting (HostGator, Bluehost, etc.)

#### Build Project
```bash
npm run build
npm start
```

#### Deploy
1. Use PM2 for process management:
```bash
npm install -g pm2
pm2 start npm --name "leafwalk" -- start
pm2 save
pm2 startup
```

2. Configure Nginx:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. Setup SSL with Let's Encrypt:
```bash
sudo certbot --nginx -d yourdomain.com
```

---

## 🎨 Customization

### Update Branding

#### 1. Logo & Images
- Replace files in `/public/logo/`
- Update hero video: `/public/videos/hero-demo2.mp4`
- Add room images: `/public/rooms/`

#### 2. Colors
Edit `app/globals.css`:
```css
:root {
  --gold: #c9a14a;  /* Primary color */
  --dark: #0b0b0b;  /* Background */
}
```

#### 3. Contact Information
Update in multiple files:
- `components/Footer.tsx`
- `app/contact/page.tsx`
- `WHATSAPP_NUMBER` in .env

#### 4. Room Prices
Update in Supabase:
```sql
UPDATE rooms SET price = 4000 WHERE slug = 'deluxe-room';
```

---

## 👤 User Roles & Access

### Admin
- Full access to admin panel
- Manage bookings, rooms, users
- View analytics
- Approve reviews

### Manager
- View bookings
- Manage availability
- Respond to inquiries

### User
- Book rooms
- View own bookings
- Write reviews
- Update profile

### Create First Admin
```sql
-- After signup via website
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

---

## 🔒 Security Best Practices

### 1. Environment Variables
- NEVER commit `.env.local` to Git
- Use different keys for dev/prod
- Rotate keys regularly

### 2. Supabase Security
- Enable Row Level Security (RLS) ✅ Already configured
- Use service role key only on server
- Never expose service role key to client

### 3. Payment Security
- Use Razorpay Test Mode in development
- Verify payment signatures on server
- Log all transactions

### 4. General Security
- Keep dependencies updated: `npm audit fix`
- Use HTTPS in production
- Enable CORS only for your domain
- Implement rate limiting (if needed)

---

## 📧 Email/SMS Setup (Optional)

### Email Notifications
Use SendGrid (free 100 emails/day):
1. Sign up at sendgrid.com
2. Create API key
3. Add to `.env.local`:
```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
```

### SMS Notifications
Use Twilio or MSG91:
```env
SMS_API_KEY=your_api_key
SMS_SENDER_ID=LEAFWALK
```

---

## 🐛 Troubleshooting

### Build Errors
```bash
# Clear cache and reinstall
rm -rf .next node_modules package-lock.json
npm install
npm run dev
```

### Database Errors
- Verify Supabase URL is correct
- Check RLS policies are enabled
- Ensure schema.sql was run completely

### Payment Issues
- Verify Razorpay keys are correct
- Check Razorpay test mode is enabled
- Verify webhook URL in Razorpay dashboard

### 404 Errors
- Check Next.js routing
- Verify file names match routes
- Clear browser cache

---

## 📊 Analytics Setup

### Google Analytics
1. Create GA4 property
2. Get Measurement ID
3. Add to `app/layout.tsx`:
```tsx
<Script src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX" />
```

### Facebook Pixel
Similar process for conversion tracking

---

## 🔄 Updates & Maintenance

### Update Dependencies
```bash
npm update
npm audit fix
```

### Backup Database
Supabase → Database → Backups (enabled by default)

### Monitor Performance
- Use Vercel Analytics (free)
- Check Lighthouse scores
- Monitor error logs

---

## 📱 Mobile App (Future)

This codebase can be adapted for:
- React Native mobile app
- Progressive Web App (PWA)
- WhatsApp Business integration

---

## 💡 Features Included

✅ Complete Booking System
✅ Payment Gateway (Razorpay)
✅ User Authentication
✅ Admin Dashboard
✅ Room Management
✅ Review System
✅ Contact Forms
✅ Email Notifications
✅ Responsive Design
✅ SEO Optimized
✅ Security Hardened
✅ Analytics Ready
✅ Production Ready

---

## 🆘 Support

### Documentation
- Next.js: https://nextjs.org/docs
- Supabase: https://supabase.com/docs
- Razorpay: https://razorpay.com/docs
- Tailwind: https://tailwindcss.com/docs

### Need Help?
- Check FAQ section
- Review code comments
- Contact developer

---

## 📄 License

Proprietary - All Rights Reserved
Leafwalk Resort © 2024

---

## ✅ Pre-Launch Checklist

Before going live:

- [ ] Environment variables configured
- [ ] Database schema applied
- [ ] Admin user created
- [ ] Room data added
- [ ] Payment gateway tested
- [ ] Contact information updated
- [ ] Images uploaded
- [ ] SEO meta tags updated
- [ ] Analytics installed
- [ ] Domain connected
- [ ] SSL enabled
- [ ] Backup strategy in place
- [ ] Error monitoring setup
- [ ] Performance tested
- [ ] Mobile tested

---

## 🎉 You're Ready!

Your production-ready resort booking platform is complete.
Just configure, deploy, and start taking bookings!

**Total Setup Time: ~30 minutes**
**Monthly Cost: ₹0 (Free tier of all services)**
