-- FaeNet - esquema social inicial no Supabase/PostgreSQL.
-- O backend Flask usa uma conexao PostgreSQL privada; anon/authenticated
-- nao recebem acesso direto as tabelas expostas no schema public.

create table public.users (
    username varchar(60) primary key,
    password_hash varchar(256) not null,
    name varchar(120) not null,
    curso varchar(80),
    turma varchar(100),
    bio text,
    avatar_text varchar(4),
    avatar_img text,
    banner_img text,
    online boolean not null default false,
    last_seen timestamp without time zone not null default timezone('utc', now()),
    joined timestamp without time zone not null default timezone('utc', now()),
    is_admin boolean not null default false,
    constraint users_username_not_blank check (btrim(username) <> ''),
    constraint users_name_not_blank check (btrim(name) <> '')
);

create table public.posts (
    id varchar(24) primary key,
    username varchar(60) not null references public.users(username) on delete cascade,
    content text not null default '',
    images_json text,
    poll_json text,
    repost_of varchar(24) references public.posts(id) on delete set null,
    timestamp timestamp without time zone not null default timezone('utc', now()),
    edited boolean not null default false,
    constraint posts_no_self_repost check (repost_of is null or repost_of <> id)
);

create table public.comments (
    id varchar(24) primary key,
    post_id varchar(24) not null references public.posts(id) on delete cascade,
    username varchar(60) not null references public.users(username) on delete cascade,
    content text not null,
    timestamp timestamp without time zone not null default timezone('utc', now()),
    constraint comments_content_not_blank check (btrim(content) <> '')
);

create table public.stories (
    id varchar(24) primary key,
    username varchar(60) not null references public.users(username) on delete cascade,
    image text not null,
    caption varchar(200),
    timestamp timestamp without time zone not null default timezone('utc', now()),
    constraint stories_image_not_blank check (btrim(image) <> '')
);

create table public.messages (
    id varchar(24) primary key,
    from_user varchar(60) not null references public.users(username) on delete cascade,
    to_user varchar(60) not null references public.users(username) on delete cascade,
    text text,
    file_url text,
    file_name varchar(200),
    file_type varchar(20),
    reply_to_json text,
    read boolean not null default false,
    timestamp timestamp without time zone not null default timezone('utc', now()),
    constraint messages_different_users check (from_user <> to_user),
    constraint messages_content_present check (
        nullif(btrim(coalesce(text, '')), '') is not null
        or nullif(btrim(coalesce(file_url, '')), '') is not null
    ),
    constraint messages_file_type_valid check (file_type is null or file_type in ('image', 'file'))
);

create table public.notifications (
    id varchar(24) primary key,
    to_user varchar(60) not null references public.users(username) on delete cascade,
    from_name varchar(120) not null,
    from_avatar_text varchar(4),
    from_avatar_img varchar(500),
    notif_type varchar(30) not null,
    text varchar(200) not null,
    read boolean not null default false,
    timestamp timestamp without time zone not null default timezone('utc', now()),
    meta_json varchar(500),
    constraint notifications_type_valid check (
        notif_type in ('like', 'comment', 'follow', 'message', 'repost')
    )
);

create table public.hub_items (
    id varchar(24) primary key,
    curso varchar(80) not null,
    item_type varchar(20) not null,
    parent_id varchar(24) references public.hub_items(id) on delete cascade,
    username varchar(60) not null references public.users(username) on delete cascade,
    title varchar(200),
    content text,
    extra_json text,
    solved boolean not null default false,
    timestamp timestamp without time zone not null default timezone('utc', now()),
    constraint hub_items_type_valid check (
        item_type in ('estagio', 'prova', 'forum_topic', 'forum_answer')
    ),
    constraint hub_items_parent_valid check (
        (item_type = 'forum_answer' and parent_id is not null)
        or (item_type <> 'forum_answer' and parent_id is null)
    )
);

create table public.followers (
    follower_id varchar(60) not null references public.users(username) on delete cascade,
    followed_id varchar(60) not null references public.users(username) on delete cascade,
    timestamp timestamp without time zone not null default timezone('utc', now()),
    primary key (follower_id, followed_id),
    constraint followers_no_self_follow check (follower_id <> followed_id)
);

create table public.post_likes (
    user_id varchar(60) not null references public.users(username) on delete cascade,
    post_id varchar(24) not null references public.posts(id) on delete cascade,
    timestamp timestamp without time zone not null default timezone('utc', now()),
    primary key (user_id, post_id)
);

create table public.post_saves (
    user_id varchar(60) not null references public.users(username) on delete cascade,
    post_id varchar(24) not null references public.posts(id) on delete cascade,
    timestamp timestamp without time zone not null default timezone('utc', now()),
    primary key (user_id, post_id)
);

create table public.post_reposts (
    user_id varchar(60) not null references public.users(username) on delete cascade,
    post_id varchar(24) not null references public.posts(id) on delete cascade,
    timestamp timestamp without time zone not null default timezone('utc', now()),
    primary key (user_id, post_id)
);

create table public.story_viewers (
    user_id varchar(60) not null references public.users(username) on delete cascade,
    story_id varchar(24) not null references public.stories(id) on delete cascade,
    timestamp timestamp without time zone not null default timezone('utc', now()),
    primary key (user_id, story_id)
);

-- Indices alinhados aos filtros e ordenacoes usados pela aplicacao.
create index ix_users_joined_desc on public.users (joined desc);
create index ix_users_online_last_seen on public.users (online, last_seen desc) where online = true;
create index ix_posts_timestamp_desc on public.posts (timestamp desc);
create index ix_posts_username_timestamp on public.posts (username, timestamp desc);
create index ix_posts_repost_of on public.posts (repost_of);
create index ix_comments_post_timestamp on public.comments (post_id, timestamp);
create index ix_comments_username on public.comments (username);
create index ix_stories_timestamp_desc on public.stories (timestamp desc);
create index ix_stories_username_timestamp on public.stories (username, timestamp desc);
create index ix_messages_conversation_forward on public.messages (from_user, to_user, timestamp desc);
create index ix_messages_conversation_reverse on public.messages (to_user, from_user, timestamp desc);
create index ix_messages_unread_recipient on public.messages (to_user, timestamp desc) where read = false;
create index ix_notifications_recipient_time on public.notifications (to_user, timestamp desc);
create index ix_notifications_unread_recipient on public.notifications (to_user, timestamp desc) where read = false;
create index ix_hub_items_course_type_time on public.hub_items (curso, item_type, timestamp desc);
create index ix_hub_items_parent_time on public.hub_items (parent_id, timestamp) where parent_id is not null;
create index ix_hub_items_username on public.hub_items (username);
create index ix_followers_followed on public.followers (followed_id, timestamp desc);
create index ix_post_likes_post on public.post_likes (post_id, timestamp desc);
create index ix_post_saves_post on public.post_saves (post_id, timestamp desc);
create index ix_post_reposts_post on public.post_reposts (post_id, timestamp desc);
create index ix_story_viewers_story on public.story_viewers (story_id, timestamp desc);

-- As tabelas pertencem ao backend Flask. O Data API nao deve expor
-- dados sociais diretamente para clientes anonimos ou autenticados.
alter table public.users enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.stories enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.hub_items enable row level security;
alter table public.followers enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_saves enable row level security;
alter table public.post_reposts enable row level security;
alter table public.story_viewers enable row level security;

revoke all on table public.users from anon, authenticated;
revoke all on table public.posts from anon, authenticated;
revoke all on table public.comments from anon, authenticated;
revoke all on table public.stories from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;
revoke all on table public.hub_items from anon, authenticated;
revoke all on table public.followers from anon, authenticated;
revoke all on table public.post_likes from anon, authenticated;
revoke all on table public.post_saves from anon, authenticated;
revoke all on table public.post_reposts from anon, authenticated;
revoke all on table public.story_viewers from anon, authenticated;

