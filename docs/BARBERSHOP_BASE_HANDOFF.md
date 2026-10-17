# Reusable Barbershop Base — replication specification

This repository remains the **Mr Handsome concept**, not a generic template or a transferable customer database.

## Clone into a new private repository
1. Create a **new private GitHub repository** for each prospect and copy the application source into it. Do not share this repository's deployment secrets, client photos, real bookings, audit history, or Cloudflare Access settings.
2. Provision a **new D1 database** for each business. Never reuse the Mr Handsome database ID.
3. Create a distinct Cloudflare Worker name, production hostname, and admin access application for each client.
4. Replace every business-specific reference: name, phone, address, directions link, map, opening hours, review statistics, review quotes, gallery photos, hero photos, email subject/sender, and branding.
5. Keep **PREVIEW_ONLY=true** and noindex on initial concepts. Require explicit approval, verified business information, privacy terms, email sender, anti-spam keys, owner authentication, and staging tests before accepting live bookings.
6. Perform source-image provenance and usage-rights checks before sending a concept to a prospect. Unverified testimonials and ratings must not be presented as verified.
7. Add a business configuration abstraction before scaling to multiple prospects rather than duplicating hardcoded constants inside React and the Worker.

## Admin preview precautions
- Admin demo mode masks live customer names and audit history by default. The 'Switch to live admin data' button is only for authorised administrators.
- Demo appointments are examples and do not write to the database.
- Do not give prospective buyers your Cloudflare Access identity. For shared demonstrations, use screenshots or a separately authorised preview identity and isolated demonstration database.

## Pitch readiness checklist (manual)
- Test on iPhone Safari, Android Chrome, Windows Firefox/Chrome and desktop Safari at ~320, 375, 390, 768, 1024 and 1440 px.
- Check hero text over photography, fixed mobile actions, no horizontal overflow, focus navigation, gallery swipes, form validation, and accessible modal dismissal.
- Confirm demo submissions do **not** write to D1 or send mail, and API POST to /api/bookings is refused.
- Confirm denied admin access without a valid Cloudflare Access assertion.
- Verify admin demo schedule does not expose actual names, staff data or logs.
- Confirm rating, review count, opening hours, photos and quotes with the business owner before production. Public directory hours and review counts vary.
- Verify maps, phone links and all relevant buttons.
- Check end-to-end real appointments only in an isolated staging deployment with a separate database.
- Remove noindex and preview PIN only on authorised production launch.

## Known limitations
- Multi-barber capacity is not implemented: one booking per date/time.
- Confirmation mail and Turnstile remain inactive until their keys and verified sending domain are configured.
- Domain purchase, pricing, maintenance and data-protection agreements are separate from technical preview.
