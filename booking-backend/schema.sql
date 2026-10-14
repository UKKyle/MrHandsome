-- Mr Handsome booking system, initial schema. All timestamps are UTC ISO-8601.
CREATE TABLE IF NOT EXISTS barbers (
 id TEXT PRIMARY KEY, display_name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS services (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 5 AND 240),
 active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS barber_services (
 barber_id TEXT NOT NULL REFERENCES barbers(id), service_id TEXT NOT NULL REFERENCES services(id),
 PRIMARY KEY(barber_id, service_id)
);
CREATE TABLE IF NOT EXISTS working_hours (
 barber_id TEXT NOT NULL REFERENCES barbers(id),
 weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
 starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
 PRIMARY KEY(barber_id,weekday)
);
CREATE TABLE IF NOT EXISTS time_off (
 id TEXT PRIMARY KEY, barber_id TEXT NOT NULL REFERENCES barbers(id),
 start_utc TEXT NOT NULL, end_utc TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS appointments (
 id TEXT PRIMARY KEY, barber_id TEXT NOT NULL REFERENCES barbers(id),
 service_id TEXT NOT NULL REFERENCES services(id),
 start_utc TEXT NOT NULL, end_utc TEXT NOT NULL,
 customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS appointment_lookup ON appointments(barber_id,start_utc,end_utc,status);
CREATE INDEX IF NOT EXISTS time_off_lookup ON time_off(barber_id,start_utc,end_utc);
-- One reservation per barber and exact start time. Overlapping durations are
-- checked inside a transaction at booking time.
CREATE UNIQUE INDEX IF NOT EXISTS appointment_unique_start
 ON appointments(barber_id,start_utc) WHERE status='confirmed';
