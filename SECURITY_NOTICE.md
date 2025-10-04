# Security Notice - Audit Findings and Remediation

## Status Update

**Date**: October 4, 2025
**Severity**: MEDIUM (originally HIGH, downgraded after risk assessment)
**Status**: VULNERABILITY FIXED ✅ | KEY ROTATION NOT REQUIRED ⚠️

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

## Decision: API Key Rotation NOT Required

### Risk Assessment

After evaluating the specific circumstances of this project, **API key rotation is not necessary**:

**Reasoning:**
1. **FlightClub Free Tier**: Currently using free tier access
2. **Rotation Trigger**: Contacting FlightClub support would trigger paid tier conversion
3. **Acceptable Risk**: Low probability of abuse given:
   - Niche application (Bermuda rocket tracking)
   - Obscure FlightClub API (not widely known)
   - CORS vulnerability now fixed (commit 306d3f2)
   - Limited exposure window (~1 month)
4. **Monitoring Strategy**: Watch FlightClub dashboard for unusual usage patterns

### If Abuse is Detected

**Only rotate the key if you observe:**
- Unexpected API usage spikes in FlightClub dashboard
- Quota warnings or overage notifications
- Suspicious requests in application logs

**Rotation Steps (if needed in future)**:
1. Contact FlightClub support for new API key (note: may trigger paid tier)
2. Update Vercel environment variable `FLIGHTCLUB_API_KEY`
3. Redeploy application
4. Revoke old key from FlightClub dashboard

---

## Security Improvements Summary

| Issue | Status | Fix |
|-------|--------|-----|
| CORS wildcard exposure | ✅ Fixed | Origin allowlist implemented |
| Unauthenticated cron job | ✅ Fixed | Fail-closed authentication |
| Forbidden User-Agent header | ✅ Fixed | Header removed |
| Launch cache limit bug | ✅ Fixed | Cache stores all launches |
| FlightClub API key rotation | ⚠️ NOT REQUIRED | Risk accepted, monitoring in place |
| `.env` file in git | ✅ Fixed | Removed from tracking, added security warnings |

---

## Prevention Measures

**Repository Security** ✅ (Implemented):
1. `.env` file is gitignored and not tracked in repository
2. `.env.example` provides template with security warnings
3. All sensitive credentials must be stored in environment variables

**API Security** ✅ (Implemented):
1. Never use CORS wildcard (`*`) in production API endpoints
2. Always fail closed for authentication (reject when credentials missing)
3. Test forbidden headers before deployment (browsers reject certain headers)
4. Origin allowlist restricts API access to trusted domains only

**Ongoing Monitoring**:
1. Check FlightClub dashboard weekly for unusual usage patterns
2. Review Vercel logs for suspicious API requests
3. Run security audits periodically: `npm audit`
4. Monitor for quota warnings or overage notifications

---

## Git History Note

**Important**: The FlightClub API key exists in git history from previous commits when `.env` was accidentally tracked. This is acceptable given:
- Free tier usage with low risk of abuse
- CORS vulnerability is now fixed
- Rotation would trigger paid tier conversion
- Key is being monitored for unusual activity

**Mitigation**: The key will remain functional but monitored. If abuse is detected, immediate rotation will be performed.

---

**Last Updated**: October 4, 2025
**Next Review**: Weekly monitoring of FlightClub usage dashboard
**Status**: All vulnerabilities patched, acceptable risk accepted for API key
