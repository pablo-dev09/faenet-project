BEGIN;
ALTER TABLE public.users ADD COLUMN handle varchar(60) UNIQUE;
ALTER TABLE public.users ADD COLUMN profile_complete boolean NOT NULL DEFAULT true;
-- Only the bridge-generated identifiers need mandatory first-time customization.
UPDATE public.users u SET profile_complete=false
WHERE username ~ '^fh_[a-f0-9]{32}$' AND EXISTS
  (SELECT 1 FROM public.faehub_links l WHERE l.username=u.username);
UPDATE public.users SET handle=lower(username) WHERE profile_complete=true;
ALTER TABLE public.users ADD CONSTRAINT users_handle_lowercase CHECK (handle IS NULL OR handle=lower(handle));
CREATE TABLE public.profile_images (
  username varchar(60) NOT NULL REFERENCES public.users(username) ON DELETE CASCADE,
  kind varchar(6) NOT NULL CHECK (kind IN ('avatar','banner')),
  content bytea NOT NULL CHECK (octet_length(content)<=409600),
  revision varchar(32) NOT NULL,
  PRIMARY KEY(username,kind)
);
ALTER TABLE public.profile_images ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profile_images FROM PUBLIC,anon,authenticated;
COMMIT;
