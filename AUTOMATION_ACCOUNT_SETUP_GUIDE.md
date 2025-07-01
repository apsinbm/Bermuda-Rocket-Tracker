# 🤖 MarketPlace Automation Account Setup Guide

**Goal**: Create a dedicated MarketPlace account that the automation system can use without interfering with your personal account.

## 📋 Step-by-Step Setup

### **Step 1: Close All Chrome Windows**
- Close any open Chrome browsers
- Make sure no Chrome processes are running

### **Step 2: Open Automation Profile**
Open Terminal and run:
```bash
open -na "Google Chrome" --args --user-data-dir="/Users/pato/Library/Application Support/Google/Chrome" --profile-directory="Automation"
```

This opens Chrome with the dedicated automation profile.

### **Step 3: Create New MarketPlace Account**

1. **Navigate to MarketPlace**:
   - Go to: https://www.marketplace.bm
   - Click "Sign Up" or "Create Account"

2. **Account Details**:
   - **Email**: `marketplace.automation.pato@gmail.com` (or use your domain)
   - **Password**: [Create a secure password - save it]
   - **Name**: Automation Account (or your name)
   - **Phone**: [Your phone number]

3. **Complete Registration**:
   - Verify email if required
   - Login to the new account

### **Step 4: Set Hamilton Store**

1. **Find Store Selection**:
   - Look for "Store Location" or "Select Store" 
   - May be in top menu, account settings, or popup

2. **Select Hamilton Store**:
   - Choose: **"The MarketPlace Hamilton, 42 Church Street, Hamilton, Bermuda HM 12"**
   - Save/confirm selection

### **Step 5: Test Price Access**

1. **Test BANANAS Product**:
   - Navigate to: https://www.marketplace.bm/shop/produce/tropical/yellow_bananas/p/12413
   - Check if price is visible immediately
   - If "Show Price" button appears, click it
   - Price should be around $2.99

2. **Test Additional Products**:
   - AVOCADO: https://www.marketplace.bm/shop/produce/tropical_fruit/green_avocados_large/p/78563
   - STRAWBERRIES: https://www.marketplace.bm/shop/produce/berries/strawberries_pint/p/2311226

### **Step 6: Verify Setup**

✅ **Success Indicators**:
- Logged into automation account
- Hamilton store selected and saved
- Prices visible on product pages
- No manual intervention required between products

⚠️ **If Issues**:
- "Show Price" still required → Note this for automation script
- Store not staying selected → Re-save store preference
- Login not persisting → Check email verification

### **Step 7: Test Automation**

Once setup is complete, test with:
```bash
python3 simple_chrome_test.py
```

This should now show:
- ✅ Automatically logged in
- ✅ Hamilton store selected
- ✅ Prices visible

## 🔒 Security Notes

- **Separate Account**: Keeps automation separate from personal use
- **Secure Password**: Use strong password for automation account
- **Limited Access**: Account only used for price monitoring
- **Profile Isolation**: Automation profile separate from your regular Chrome

## 🚀 Ready for Tonight

Once this setup is complete:
- **Manual intervention**: Only needed once (account creation)
- **Autonomous operation**: Full 4-hour overnight monitoring
- **No interference**: Your regular Chrome/account unaffected

---

**Complete this setup, then let me know if the automation account works!**