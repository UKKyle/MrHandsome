-- Configurable staff and schedules. UTC timestamps stored as ISO 8601.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS barbers (
 id TEXT PRIMARY KEY,
 display_name TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS services (
 id TEXT PRIMARY KEY, title TEXT NOT NULL,
 duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 5 AND 240),
 buffer_minutes INTEGER NOT NULL DEFAULT 0 CHECK(buffer_minutes BETWEEN 0 AND 120),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
CREATE TABLE IF NOT EXISTS barber_services (
 barber_id TEXT NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
 service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
 PRIMARY KEY(barber_id,service_id)
);
-- Multiple shift segments allow lunch breaks and split shifts on any weekday.
-- Weekday 0=Sunday, 6=Saturday. HH:MM local Europe/London time.
CREATE TABLE IF NOT EXISTS working_hours (
 id TEXT PRIMARY KEY,
 barber_id TEXT NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
 weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
 starts_at TEXT NOT NULL CHECK(length(starts_at)=5),
 ends_at TEXT NOT NULL CHECK(length(ends_at)=5),
 CHECK(starts_at < ends_at)
);
CREATE INDEX IF NOT EXISTS working_hours_lookup ON working_hours(barber_id,weekday);
CREATE TABLE IF NOT EXISTS time_off (
 id TEXT PRIMARY KEY, barber_id TEXT NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
 start_utc TEXT NOT NULL, end_utc TEXT NOT NULL, CHECK(start_utc < end_utc)
);
CREATE INDEX IF NOT EXISTS time_off_lookup ON time_off(barber_id,start_utc,end_utc);
CREATE TABLE IF NOT EXISTS appointments (
 id TEXT PRIMARY KEY,
 barber_id TEXT NOT NULL REFERENCES barbers(id),
 service_id TEXT NOT NULL REFERENCES services(id),
 start_utc TEXT NOT NULL, end_utc TEXT NOT NULL,
 customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(start_utc < end_utc)
);
CREATE INDEX IF NOT EXISTS appointment_lookup ON appointments(barber_id,start_utc,end_utc,status);
CREATE UNIQUE INDEX IF NOT EXISTS appointment_unique_start
 ON appointments(barber_id,start_utc) WHERE status='confirmed';
-- Atomic overlap protection: insert/update cannot double-book a barber,
-- even with different start times. End boundaries are exclusive.
CREATE TRIGGER IF NOT EXISTS appointment_reject_overlap_insert
 BEFORE INSERT ON appointments WHEN NEW.status='confirmed'
 BEGIN
 SELECT RAISE(ABORT,'barber unavailable')
 WHERE EXISTS (
 SELECT 1 FROM appointments a
 WHERE a.barber_id=NEW.barber_id AND a.status='confirmed'
 AND a.start_utc<NEW.end_utc AND a.end_utc>NEW.start_utc
 );
 END;
CREATE TRIGGER IF NOT EXISTS appointment_reject_overlap_update
 BEFORE UPDATE OF barber_id,start_utc,end_utc,status ON appointments
 WHEN NEW.status='confirmed'
 BEGIN
 SELECT RAISE(ABORT,'barber unavailable')
 WHERE EXISTS (
 SELECT 1 FROM appointments a
 WHERE a.id<>NEW.id AND a.barber_id=NEW.barber_id AND a.status='confirmed'
 AND a.start_utc<NEW.end_utc AND a.end_utc>NEW.start_utc
 );
 END;
