-- Preserva avatares que já tenham sido criados pelo protótipo.
create table if not exists public.user_avatars (
    username varchar(60) primary key references public.users (username) on delete cascade,
    skin varchar(24) not null default 'medium',
    gender varchar(16) not null default 'male',
    hair_style varchar(24) not null default 'spiky',
    hair_color varchar(24) not null default 'dark',
    top_style varchar(24) not null default 'hoodie',
    top_color varchar(24) not null default 'violet',
    bottom_style varchar(24) not null default 'pants',
    bottom_color varchar(24) not null default 'navy',
    shoe_style varchar(24) not null default 'sneakers',
    shoe_color varchar(24) not null default 'white',
    accessory varchar(24) not null default 'none',
    accessories varchar(160) not null default '',
    updated_at timestamp not null default now()
);

alter table public.user_avatars
    add column if not exists gender varchar(16) not null default 'male',
    add column if not exists bottom_style varchar(24) not null default 'pants',
    add column if not exists shoe_style varchar(24) not null default 'sneakers',
    add column if not exists accessories varchar(160) not null default '';

alter table public.user_avatars enable row level security;
revoke all on table public.user_avatars from anon, authenticated;
