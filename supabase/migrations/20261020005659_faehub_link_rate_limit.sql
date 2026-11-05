BEGIN;
CREATE TABLE public.faehub_link_attempts (
  id varchar(64) PRIMARY KEY,
  attempts integer NOT NULL,
  until_at bigint NOT NULL
);
ALTER TABLE public.faehub_link_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.faehub_link_attempts FROM PUBLIC,anon,authenticated;
COMMIT;
