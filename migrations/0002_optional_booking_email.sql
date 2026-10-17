-- Additive migration for optional transactional booking confirmations.
-- Existing bookings remain valid; legacy rows have NULL customer_email.
-- Applied to live D1 on 2026-10-17; retain for reproducible setups.
ALTER TABLE simple_bookings ADD COLUMN customer_email TEXT;
