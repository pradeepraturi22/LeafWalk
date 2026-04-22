# Local Testing Notes

## What Was Relaxed For Local Only

- CSP can allow inline scripts only when:
  - `NODE_ENV=development`
  - or `LOCAL_TEST_MODE=true` with `ALLOW_LOCAL_INLINE_SCRIPTS=true`
- CSP can allow `unsafe-eval` only when:
  - `NODE_ENV=development`
  - or `LOCAL_TEST_MODE=true` with `ALLOW_LOCAL_INLINE_SCRIPTS=true`
- Internal cron/admin notify routes can use a localhost-only bypass only when:
  - `LOCAL_TEST_MODE=true`
  - `ALLOW_LOCAL_INTERNAL_BYPASS=true`
- Email, SMS, and WhatsApp sends default to mock mode in local testing unless explicitly switched to real transport.
- If SMTP/Resend/SendGrid is configured locally and `LOCAL_NOTIFICATION_MODE` is not set, email now auto-uses real send in local mode.
- Extra debug logging is enabled in local testing mode for payments, notifications, and internal route checks.
- Booking email triggers are active in local mode for:
  - tour operator registration
  - tour operator booking creation/status
  - walk-in booking confirmation
  - direct booking confirmation
  - website/online payment verification confirmation

## Environment Variables Added

- `LOCAL_TEST_MODE=true`
- `ALLOW_LOCAL_INLINE_SCRIPTS=true`
- `ALLOW_LOCAL_INTERNAL_BYPASS=true`
- `LOCAL_NOTIFICATION_MODE=mock`
- `LOCAL_NOTIFICATION_MODE=real`
- `CUSTOM_AUTH_SECRET=...`

## What Automatically Switches Off In Production

- Local CSP inline-script relaxation
- Local CSP eval relaxation
- Local internal route bypass
- Local mock notification mode defaults
- Local debug logging
- Razorpay test-key convenience logging

## What To Verify Before Production Deploy

1. `LOCAL_TEST_MODE` is unset or `false`
2. `ALLOW_LOCAL_INLINE_SCRIPTS` is unset or `false`
3. `ALLOW_LOCAL_INTERNAL_BYPASS` is unset or `false`
4. `LOCAL_NOTIFICATION_MODE` is unset or `real`
5. `NEXT_PUBLIC_RAZORPAY_KEY_ID` uses a live key in production
6. `CUSTOM_AUTH_SECRET` is set to a dedicated production secret
7. `INTERNAL_API_SECRET` is set correctly for cron/internal routes
8. Production CSP response does not include `unsafe-inline` for scripts
9. Localhost-only bypasses are not active in deployed environment

## Exact Rollback Steps If Needed

1. Set `LOCAL_TEST_MODE=false`
2. Set `ALLOW_LOCAL_INLINE_SCRIPTS=false`
3. Set `ALLOW_LOCAL_INTERNAL_BYPASS=false`
4. Set `LOCAL_NOTIFICATION_MODE=real`
5. Redeploy

## Local Testing Example

```env
LOCAL_TEST_MODE=true
ALLOW_LOCAL_INLINE_SCRIPTS=true
ALLOW_LOCAL_INTERNAL_BYPASS=true
LOCAL_NOTIFICATION_MODE=mock
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_test_secret
CUSTOM_AUTH_SECRET=local-dev-only-secret
```

## Local Email Testing Modes

- `LOCAL_NOTIFICATION_MODE=mock`
  - booking flow continues successfully
  - intended email recipient, subject, and trigger are written to local logs
- `LOCAL_NOTIFICATION_MODE=real`
  - actual SMTP/Resend/SendGrid sending is attempted
  - use only test inboxes in local development
- `LOCAL_NOTIFICATION_MODE` unset
  - if a real email provider is configured, local mode sends real email
  - if no provider is configured, local mode falls back to mock

## Booking Trigger Matrix

- Tour operator registration: welcome email sent once after operator create
- Tour operator booking: operator status email sent on create/status change; guest confirmation sent when booking is confirmed or checked in
- Walk-in booking: guest confirmation sent on admin create when guest email exists
- Direct booking: guest confirmation sent on admin create when guest email exists
- Website/public booking create: no premature confirmation while booking stays pending/unpaid
- Website/online payment verify: guest booking confirmation and payment success emails sent after successful verification

## Localhost CSP Note

- In `NODE_ENV=development`, inline scripts are allowed automatically for local testing.
- In `NODE_ENV=development`, eval is also allowed automatically for local tooling compatibility.
- If you want the same behavior outside normal dev mode, use:
  - `LOCAL_TEST_MODE=true`
  - `ALLOW_LOCAL_INLINE_SCRIPTS=true`
