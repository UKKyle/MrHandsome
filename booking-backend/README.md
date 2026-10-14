# Mr Handsome booking engine — staged, not live

This directory contains the foundation for a first-party, source-available booking service designed for Cloudflare Workers + D1, matching the existing Vite/React frontend. This is original code, not a copy of Easy!Appointments.

## Current state
- Database schema staged for review.
- **No database provisioned. No customer data collected. No booking API deployed.**
- The existing website's sample times remain illustrative, not real availability.
- Do not enable public booking or accept customer details until authentication, rate limiting, validation, concurrency tests, retention/deletion procedures, and privacy documentation have been implemented and verified.

## Appointment data model
- Barbers, services and service durations.
- Per-barber service eligibility and weekly working hours.
- Time off/closed intervals.
- Appointments with status and timestamps.

## Before activation
1. Confirm number of barbers, actual services, durations, prices, and breaks.
2. Agree on time zone (Europe/London), advance-booking rules, buffers and cancellation policy.
3. Provision D1 and migrations in a separate deployment with an authenticated admin.
4. Implement an atomic booking transaction with server-side overlap checks (a unique start index alone does not prevent all overlapping appointments).
5. Implement public availability from actual schedules plus time off and appointments; never show invented availability.
6. Configure abuse prevention, bot protection, TLS, server-side authorization, backups, audit logging without sensitive details, and data deletion/retention.
7. Decide whether name and phone only is sufficient; no marketing checkbox preselected.
8. Complete the ICO's official fee self-assessment for the barbershop and assess the platform operator's separate obligations.
9. Verify production and staging end to end before letting customers book.

## Regulatory boundary
Using open source does not automatically remove ICO data-protection-fee obligations or UK GDPR responsibilities. Review the business's actual purposes, CCTV and marketing practices.

References: https://ico.org.uk/for-organisations/data-protection-fee/data-protection-fee/exemptions/

## Deployment
Do **not** add a D1 binding to the existing production Worker until a reviewed and tested booking backend is ready.
