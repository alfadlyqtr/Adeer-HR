# Production Password Reset Configuration

## ✅ Updated for Production URL

The forgot password feature is now configured for your production deployment!

## 🌐 Production URL

**Your App:** https://adeer-hr.vercel.app/

## 🔧 Updated Configuration

### **Forgot Password Page**
**File:** `src/app/(auth)/forgot-password/page.tsx`

**Reset URL Logic:**
```tsx
const resetUrl = process.env.NODE_ENV === 'production' 
  ? 'https://adeer-hr.vercel.app/reset-password'
  : `${window.location.origin}/reset-password`;
```

**How it works:**
- ✅ **Production:** Uses `https://adeer-hr.vercel.app/reset-password`
- ✅ **Development:** Uses `http://localhost:3000/reset-password`
- ✅ **Automatic:** Switches based on environment

## 📧 Supabase Email Template Configuration

You need to configure this in your **Supabase Dashboard**:

### **Step 1: Go to Supabase Dashboard**
1. Open: https://supabase.com/dashboard
2. Select your project
3. Navigate to: **Authentication** → **Email Templates**

### **Step 2: Configure Reset Password Template**
1. Click on **"Reset Password"** template
2. Update the redirect URL to: `https://adeer-hr.vercel.app/reset-password`
3. Save the template

### **Step 3: Verify Email Settings**
1. Go to: **Authentication** → **Settings**
2. Check **Site URL:** Should be `https://adeer-hr.vercel.app`
3. Check **Redirect URLs:** Add `https://adeer-hr.vercel.app/reset-password`

## 🔗 Complete URLs

### **Production URLs:**
- **App:** https://adeer-hr.vercel.app/
- **Login:** https://adeer-hr.vercel.app/login
- **Forgot Password:** https://adeer-hr.vercel.app/forgot-password
- **Reset Password:** https://adeer-hr.vercel.app/reset-password
- **Settings:** https://adeer-hr.vercel.app/settings

### **Development URLs:**
- **App:** http://localhost:3000/
- **Login:** http://localhost:3000/login
- **Forgot Password:** http://localhost:3000/forgot-password
- **Reset Password:** http://localhost:3000/reset-password
- **Settings:** http://localhost:3000/settings

## 🎯 User Flow (Production)

### **Complete Password Reset Flow:**
```
1. User goes to: https://adeer-hr.vercel.app/login
   ↓
2. Clicks "Forgot password?" link
   ↓
3. Redirected to: https://adeer-hr.vercel.app/forgot-password
   ↓
4. Enters email and submits
   ↓
5. Supabase sends email with magic link
   ↓
6. User clicks link in email
   ↓
7. Redirected to: https://adeer-hr.vercel.app/reset-password
   ↓
8. Enters new password
   ↓
9. Password updated in Supabase
   ↓
10. User can login with new password
```

## 📧 Email Template Example

Your Supabase email should look like this:

```html
<h2>Reset Password</h2>
<p>Follow this link to reset your password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>
```

The `{{ .ConfirmationURL }}` will automatically include:
- Your reset URL: `https://adeer-hr.vercel.app/reset-password`
- Plus authentication tokens

## 🔒 Security Settings

### **Supabase Auth Settings to Configure:**

1. **Site URL:**
   ```
   https://adeer-hr.vercel.app
   ```

2. **Redirect URLs (Allowed):**
   ```
   https://adeer-hr.vercel.app/**
   https://adeer-hr.vercel.app/reset-password
   https://adeer-hr.vercel.app/dashboard
   ```

3. **Email Rate Limiting:**
   - Default: 4 emails per hour per user
   - Adjust if needed in Supabase settings

## ✅ Testing Checklist

### **Production Testing:**
1. [ ] Go to https://adeer-hr.vercel.app/login
2. [ ] Click "Forgot password?"
3. [ ] Enter your email
4. [ ] Check inbox for reset email
5. [ ] Click link in email
6. [ ] Verify redirects to https://adeer-hr.vercel.app/reset-password
7. [ ] Enter new password
8. [ ] Verify password is updated
9. [ ] Login with new password

### **Development Testing:**
1. [ ] Run app locally (npm run dev)
2. [ ] Go to http://localhost:3000/login
3. [ ] Click "Forgot password?"
4. [ ] Verify redirects to http://localhost:3000/forgot-password
5. [ ] Test email flow works

## 🚀 Deployment Notes

### **Environment Variables:**
Make sure these are set in Vercel:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### **Vercel Configuration:**
- ✅ Environment variables set
- ✅ Build succeeds
- ✅ Domain configured
- ✅ HTTPS enabled (automatic)

## 📱 Mobile/Email Client Compatibility

The reset link will work on:
- ✅ Desktop browsers
- ✅ Mobile browsers
- ✅ Email clients (Gmail, Outlook, etc.)
- ✅ Webmail interfaces

## 🔧 Troubleshooting

### **Issue: Email not received**
- Check spam folder
- Verify email in Supabase users table
- Check Supabase email logs

### **Issue: Reset link doesn't work**
- Verify redirect URL in Supabase settings
- Check if link expired (default: 1 hour)
- Ensure URL matches exactly

### **Issue: "Invalid session" error**
- Link may have been used already
- Link may have expired
- Request new reset email

## 📊 Monitoring

### **Check in Supabase Dashboard:**
1. **Auth Logs:** See password reset attempts
2. **Email Logs:** Track email delivery
3. **User Activity:** Monitor successful resets

## ✨ Summary

Your password reset is now configured for production:

✅ **Production URL:** https://adeer-hr.vercel.app/reset-password
✅ **Development URL:** http://localhost:3000/reset-password
✅ **Auto-switching:** Based on environment
✅ **Ready to deploy:** Just configure Supabase email template

## 🎯 Next Steps

1. **Deploy to Vercel** (if not already deployed)
2. **Configure Supabase email template** with production URL
3. **Test the complete flow** on production
4. **Monitor email delivery** in Supabase dashboard

Your password reset feature is production-ready! 🚀
