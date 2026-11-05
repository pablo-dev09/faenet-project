BEGIN;
CREATE TABLE public.faehub_links (
  subject varchar(36) PRIMARY KEY,
  username varchar(60) NOT NULL UNIQUE REFERENCES public.users(username)
);
CREATE TABLE public.faehub_sessions (
  id varchar(64) PRIMARY KEY,
  subject varchar(36) NOT NULL,
  token_ciphertext text NOT NULL,
  expires_at bigint NOT NULL
);
CREATE TABLE public.faehub_flows (
  id varchar(64) PRIMARY KEY,
  verifier_ciphertext text NOT NULL,
  expires_at bigint NOT NULL
);
CREATE TABLE public.faehub_pending (
  id varchar(64) PRIMARY KEY,
  subject varchar(36) NOT NULL,
  token_ciphertext text NOT NULL,
  expires_at bigint NOT NULL,
  attempts integer NOT NULL DEFAULT 0
);
ALTER TABLE public.faehub_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faehub_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faehub_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faehub_pending ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.faehub_links,public.faehub_sessions,public.faehub_flows,public.faehub_pending FROM PUBLIC,anon,authenticated;
COMMIT;
