# ⚡ QUICK START - 5 Minutes to Running Website

## 🎯 Goal
Get your Leafwalk Resort website running locally in 5 minutes!

---

## Step 1: Extract & Install (2 minutes)

```bash
# Extract the zip file
unzip leafwalk-resort-production-ready.zip
cd leafwalk-enhanced

# Install dependencies
npm install
```

---

## Step 2: Environment Setup (2 minutes)

### Create Supabase Account (FREE)
1. Go to https://supabase.com
2. Click "Start your project"
3. Create new project
4. Wait 2 minutes for database

### Get Your Keys
1. Click on your project
2. Go to Settings → API
3. Copy these 2 keys:
   - `Project URL`
   - `anon public` key

### Setup .env.local
```bash
# Create environment file
cp .env.example .env.local

# Edit .env.local and add:
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# For now, use these test Razorpay keys (replace later):
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_OqPjde5u9PRYKQ
RAZORPAY_KEY_SECRET=test_secret_key
```

---

## Step 3: Setup Database (1 minute)

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Open `database/schema.sql` from your project
4. Copy ALL the contents
5. Paste in Supabase SQL Editor
6. Click **RUN**
7. Wait 10 seconds ✅

---

## Step 4: Run the Website! (30 seconds)

```bash
npm run dev
```

**🎉 Done!** Open http://localhost:3000

---

## 🎨 What You'll See

✅ Beautiful homepage with video
✅ Rooms page with 3 sample rooms
✅ Booking system (fully functional)
✅ Admin panel at /admin/login
✅ User dashboard

---

## 👤 Create Admin User

1. Go to http://localhost:3000/signup
2. Sign up with your email
3. Go to Supabase dashboard
4. Click **SQL Editor** → **New query**
5. Run this:

```sql
UPDATE users 
SET role = 'admin' 
WHERE email = 'your-email@example.com';
```

6. Now login at /admin/login ✅

---

## 🧪 Test Booking Flow

1. Go to Rooms page
2. Click on any room
3. Use test credit card:
   - **Card**: 4111 1111 1111 1111
   - **Expiry**: Any future date
   - **CVV**: Any 3 digits
4. Complete booking ✅

---

## 📝 Important Files

- `SETUP_GUIDE.md` - Full setup instructions
- `DEPLOYMENT_CHECKLIST.md` - Before going live
- `README.md` - Complete documentation
- `database/schema.sql` - Database structure

---

## 🚀 Ready to Deploy?

### Vercel (Recommended - Takes 3 minutes)

```bash
# Push to GitHub
git init
git add .
git commit -m "Initial commit"
git push -u origin main

# Deploy
1. Go to https://vercel.com
2. Click "New Project"
3. Import your GitHub repo
4. Add environment variables from .env.local
5. Click Deploy
```

**🎉 Your site will be live at: `https://your-project.vercel.app`**

---

## 🆘 Common Issues

### "Cannot connect to Supabase"
- Check your .env.local file
- Verify URL and keys are correct
- Make sure no extra spaces

### "npm install fails"
```bash
rm -rf node_modules package-lock.json
npm install
```

### "Database error"
- Make sure you ran schema.sql in Supabase
- Check all tables exist in Table Editor

---

## 📞 Need Help?

Check these files:
1. `SETUP_GUIDE.md` - Detailed instructions
2. `README.md` - Complete documentation
3. `DEPLOYMENT_CHECKLIST.md` - Production setup

---

## ✅ Success Checklist

- [ ] Website running on localhost:3000
- [ ] Can see all pages
- [ ] Database tables created
- [ ] Can sign up
- [ ] Can make test booking
- [ ] Admin panel accessible

---

**That's it! You're ready to customize and deploy! 🎉**

**Next Steps:**
1. Update room content & prices
2. Add your images
3. Configure payment gateway
4. Deploy to production
5. Start taking bookings!

---

**Made with ❤️ - Production Ready - Professional Quality**
