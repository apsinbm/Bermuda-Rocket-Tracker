# Security Notice - API Key Rotation Required

## Critical Action Required

**Date**: October 4, 2025
**Severity**: HIGH
**Status**: FIXED (code deployed), KEY ROTATION PENDING

---

## Issue Summary

A security audit revealed that the FlightClub API key was exposed to the internet through CORS wildcard (`Access-Control-Allow-Origin: *`) configuration in three API endpoints:

1. `/api/flightclub/missions`
2. `/api/flightclub/simulation/[missionId]`
3. `/api/spacelaunchschedule/index`

**Impact**: Any website on the internet could abuse your FlightClub API quota and potentially incur costs.

---

## Fixes Applied (Commit: 306d3f2)

### 1. CORS Origin Allowlist ✅
All API endpoints now use origin allowlist instead of wildcard:

```typescript
const allowedOrigins = [
  'https://bermuda-rocket-tracker.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002'
];

const origin = req.headers.origin || '';
if (allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
}
```

### 2. CRON Job Authentication ✅
Fixed `/api/jobs/refresh-flightclub` to fail closed:

```typescript
if (!process.env.CRON_SECRET) {
  // Reject instead of allowing all requests
  return false;
}
```

### 3. Additional Bug Fixes ✅
- Removed forbidden `User-Agent` header (was breaking Space Launch Schedule fallback)
- Fixed launch cache to respect different limit values

---

## Required Next Steps

### ⚠️ IMMEDIATE: Rotate FlightClub API Key

**Why**: The old API key `apitn_p43xs5ha3` was exposed via CORS wildcard and should be considered compromised.

**Steps**:

1. **Generate New API Key** at FlightClub.io:
   - Log in to your FlightClub Professional account
   - Navigate to API Settings
   - Generate a new API key
   - Copy the new key

2. **Update Environment Variables**:

   **Local Development** (`.env` file):
   ```bash
   # Update this line with new key
   FLIGHTCLUB_API_KEY=your_new_api_key_here
   ```

   **Vercel Production**:
   ```bash
   # Option 1: Vercel Dashboard
   # 1. Go to https://vercel.com/your-project/settings/environment-variables
   # 2. Edit FLIGHTCLUB_API_KEY
   # 3. Set new value
   # 4. Redeploy

   # Option 2: Vercel CLI
   vercel env rm FLIGHTCLUB_API_KEY production
   vercel env add FLIGHTCLUB_API_KEY production
   # Enter new key when prompted
   vercel --prod
   ```

3. **Revoke Old API Key** at FlightClub.io:
   - Delete the old key `apitn_p43xs5ha3` from your account
   - This prevents any abuse of the exposed key

4. **Set CRON_SECRET** (if not already configured):
   ```bash
   # Generate a secure random secret
   openssl rand -base64 32

   # Add to Vercel environment variables
   vercel env add CRON_SECRET production
   # Paste the generated secret

   # Update your cron job configuration to use:
   # Authorization: Bearer <your_cron_secret>
   ```

5. **Verify Deployment**:
   ```bash
   # Test that API endpoints still work
   curl https://bermuda-rocket-tracker.vercel.app/api/flightclub/missions

   # Test that unauthorized origins are blocked (should fail)
   curl -H "Origin: https://evil-site.com" \
        https://bermuda-rocket-tracker.vercel.app/api/flightclub/missions
   ```

---

## Security Improvements Summary

| Issue | Status | Fix |
|-------|--------|-----|
| CORS wildcard exposure | ✅ Fixed | Origin allowlist implemented |
| Unauthenticated cron job | ✅ Fixed | Fail-closed authentication |
| Forbidden User-Agent header | ✅ Fixed | Header removed |
| Launch cache limit bug | ✅ Fixed | Cache stores all launches |
| FlightClub API key rotation | ⚠️ PENDING | **Manual action required** |

---

## Prevention Measures

Going forward, ensure:

1. **Never use CORS wildcard (`*`)** in production API endpoints
2. **Always fail closed** for authentication (reject when credentials missing)
3. **Test forbidden headers** before deployment (browsers reject certain headers)
4. **Regular security audits** - run automated tools like `npm audit`
5. **Environment variable validation** - verify all required secrets are configured

---

## Questions?

If you need assistance with API key rotation or have questions about the security fixes:

1. Review the commit diff: `git show 306d3f2`
2. Check the code audit findings in the previous conversation
3. Test locally with `vercel dev` before deploying to production

---

**Last Updated**: October 4, 2025
**Next Review**: After API key rotation is complete
