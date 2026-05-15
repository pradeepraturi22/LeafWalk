# Security Checklist

This checklist is the working baseline for security reviews on the LeafWalk project.

## Current technical controls

- Admin APIs require authenticated admin or manager users.
- Admin session cookies are signed and time-bound.
- Middleware applies CSP, HSTS, frame, referrer, and permissions headers.
- Rate limiting exists for sensitive public and admin API paths.
- Payment verification uses HMAC validation for Razorpay callbacks.
- Supabase service-role access is server-side only.
- Public uploads are limited by size and MIME/signature checks.

## Required production configuration

- Set strong values for:
  - `ADMIN_SESSION_SECRET`
  - `CUSTOM_AUTH_SECRET`
  - `OTP_SECRET`
  - `INTERNAL_API_SECRET`
  - `PREVIEW_ACCESS_SECRET`
  - `RAZORPAY_KEY_SECRET`
  - `RAZORPAY_WEBHOOK_SECRET`
- Keep all secrets in the deployment platform secret store only.
- Rotate secrets immediately if logs, screenshots, exports, or backups expose them.
- Ensure `LOCAL_TEST_MODE` is disabled in production.
- Ensure `ALLOW_LOCAL_INTERNAL_BYPASS` is disabled in production.
- Ensure `ALLOW_LOCAL_INLINE_SCRIPTS` is disabled in production.

## Operational checks

- Review admin users and roles regularly.
- Review notification logs for repeated failures or suspicious spikes.
- Review booking/payment changes for abnormal manual edits.
- Confirm backups exist for the database and uploaded assets.
- Confirm monitoring exists for payment webhooks and mail delivery failures.

## Recommended recurring verification

Run these before important releases:

```powershell
npm run type-check
npm run build
npm run lint
```

## Remaining hardening recommendations

- Add dependency vulnerability scanning in CI.
- Add automated secret scanning in CI.
- Add structured audit logging for admin mutations where still missing.
- Add periodic manual review of CSP exceptions and external domains.
- Add deployment-level access review for Vercel, Supabase, Razorpay, and mail providers.
