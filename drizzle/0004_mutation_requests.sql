-- Durable retry identity. No financial payload or credentials are retained here.
CREATE TABLE mutation_requests (
  user_id text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  payload_hash text NOT NULL,
  result jsonb NOT NULL DEFAULT '{}',
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX mutation_requests_owner_request_uq ON mutation_requests(user_id, request_id);
