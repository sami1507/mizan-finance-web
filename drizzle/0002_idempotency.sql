CREATE TABLE processed_events (id text PRIMARY KEY, user_id text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE, key text NOT NULL, created_at timestamp NOT NULL DEFAULT now());
CREATE UNIQUE INDEX processed_events_owner_key_uq ON processed_events(user_id,key);
