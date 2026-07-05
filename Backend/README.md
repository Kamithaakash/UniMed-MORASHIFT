# Email OTP Setup Guide for UniMed

## ✅ What I Fixed:

1. **OTP Storage** - Now stores OTPs in MongoDB (not memory) ✓ Works on Vercel
2. **Auto-expiry** - OTPs expire after 10 minutes automatically
3. **Email Sending** - Uses Brevo SMTP to send OTP codes
4. **Password Reset** - Complete flow: Send OTP → Verify → Reset Password

---

## 🔧 Setup Email Service (Brevo SMTP)

### Use Brevo (Recommended - FREE)

1. **Create Account**: Go to [brevo.com](https://www.brevo.com) (formerly Sendinblue)
2. **Sign up** with any email (it's FREE - 300 emails/day)
3. **Get SMTP Credentials**:
   - Go to: **Settings** → **SMTP & API**
   - Copy your **SMTP Key**
   - Your login is usually: `your-email@example.com`

4. **Add to Vercel**:
   ```
   Go to: Vercel Dashboard → Your Project → Settings → Environment Variables
   
   Add these:
   - Key: BREVO_SMTP_KEY
   - Value: (paste your SMTP key)
   
   - Key: BREVO_LOGIN  
   - Value: (your Brevo email)
   ```

5. **Redeploy**: Click "Redeploy" in Vercel Deployments tab


---

## 📧 How Password Reset Works Now:

1. Student clicks **"Forgot Password?"**
2. Enters **Index Number** → Verified in database
3. Enters **@uom.lk Email**
4. Backend generates **6-digit OTP** and saves to MongoDB
5. **Email sent** with OTP code
6. Student enters **OTP + New Password**
7. Backend verifies OTP → Updates password → Deletes OTP

---

## 🚀 Deploy Instructions:

```bash
cd unimed-backend-main
git add .
git commit -m "Add OTP email password reset"
git push
```

Vercel will auto-deploy! ✅

---

## 🧪 Testing:

After deployment, test the flow:
1. Open your app
2. Click "Forgot Password?"
3. Enter a real student index
4. Enter your real @uom.lk email
5. Check email for OTP code
6. Reset password

---

## ⚠️ Troubleshooting:

**"Email not sending"**
- Check if BREVO_SMTP_KEY is set in Vercel
- Check Brevo dashboard for any errors
- Verify email quota (300/day on free plan)

**"OTP expired"**
- OTPs expire after 10 minutes
- Request a new code

**"Network error"**
- Check if backend is deployed
- Check API_BASE_URL in frontend matches your Vercel URL

---

## 📊 MongoDB OTP Collection Structure:

```json
{
  "email": "student@uom.lk",
  "otp": "123456",
  "indexNumber": "240000R",
  "expiresAt": "2026-03-27T12:00:00Z"
}
```

MongoDB automatically deletes expired OTPs! ✨
