-- Newsletter v2 subscriber list (Cloudflare D1, bound as NEWSLETTER_DB).
-- Double opt-in: a signup creates a `pending` row; clicking the emailed
-- confirm link flips it to `confirmed`. Unsubscribe flips to `unsubscribed`
-- (we keep the row as a suppression record rather than deleting).
--
-- Apply (remote/prod):
--   wrangler d1 execute vectismail-newsletter --remote --file=migrations/0001_subscribers.sql
CREATE TABLE IF NOT EXISTS subscribers (
  email           TEXT PRIMARY KEY,                 -- normalised lower-case
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | confirmed | unsubscribed
  token           TEXT NOT NULL,                    -- opaque, unguessable; used for confirm + unsubscribe links
  source          TEXT,                             -- where the signup came from (footer, docs:<slug>, …)
  created_at      TEXT NOT NULL,                    -- ISO-8601 UTC, first signup
  confirmed_at    TEXT,                             -- ISO-8601 UTC, set on confirm
  unsubscribed_at TEXT                              -- ISO-8601 UTC, set on unsubscribe
);

-- Token lookups drive the confirm + unsubscribe endpoints.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_token ON subscribers(token);

-- Broadcast queries select confirmed subscribers.
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
