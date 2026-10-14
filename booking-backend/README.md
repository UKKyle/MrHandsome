# Mr Handsome — configurable booking engine (development foundation)

A reusable staff-aware scheduling data model designed for Cloudflare Workers and D1. This is original project code, not an integrated third-party booking product.

## Staff capacity
There is **no hard-coded number of barbers**. Add, deactivate or order staff in the `barbers` table. Each barber has independent:
- service eligibility through `barber_services`
- any number of weekday work intervals through `working_hours` (split shifts/breaks)
- holidays and time off through `time_off`
- appointments and bookings

Services have configurable duration and cleanup buffers. Do not delete staff with future appointments: deactivate them.

## Migration
`schema.sql` defines the intended initial schema for a fresh D1 database. The earlier draft was never deployed or migrated. Run it only in a new development database after provisioning. If an existing database is later created, manage subsequent edits with versioned migrations.

## Status & safety
**No database, live availability API, or real booking functionality has been deployed.** The public preview still displays illustrative slots. No customer personal data is accepted through the new backend. Do not claim that example times are available.

SQL triggers ensure that two confirmed appointments for the same barber cannot overlap, including when starting times differ. The API must still validate service eligibility, opening hours, daylight-saving conversion in Europe/London, time off, requested buffers, future-only dates, and duration before inserting. Workers/D1 write errors must be handled without exposing customer details. Tests must cover concurrency, cancellation and rescheduling.

## Production prerequisites
- Server-side staff admin authorization and MFA (a hidden URL or client-side PIN is insufficient).
- Authenticated configuration management for barbers, services, split shifts and absences.
- Server-calculated availability and atomic confirmation; never trust client-selected duration or barber.
- Privacy notice, appropriate retention, access/correction/deletion, and processor agreements.
- Rate limits, bot controls, minimal personal data, encryption in transit and backups.
- ICO fee self-assessment by each barber business; open-source software does not itself determine exemption.
- Confirm real business settings and consent before enabling bookings.

The production Worker currently serves the Vite static frontend; no D1 binding should be added until the booking API is reviewed and tested.
