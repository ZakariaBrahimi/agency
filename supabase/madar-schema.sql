-- Madar (community section of the Nawa site, /madar). Applied to the Supabase project "nawa" as migration "madar_community".
create table public.madar_posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('article', 'tip', 'episode')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  topic text not null check (topic in ('product', 'agile', 'dev', 'design', 'social', 'it')),
  title text not null check (char_length(title) between 1 and 200),
  excerpt text not null default '' check (char_length(excerpt) <= 400),
  body text not null default '' check (char_length(body) <= 60000),
  author_name text not null default 'فريق نواة',
  author_role text not null default '',
  series text not null default '',
  series_part int,
  featured boolean not null default false,
  number int,
  audio_url text not null default '',
  duration_min int,
  chapters jsonb not null default '[]'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.madar_posts is 'Madar community content (/madar): articles, tips and podcast episodes. Body is Markdown.';
create index madar_posts_pub on public.madar_posts (status, kind, published_at desc);
alter table public.madar_posts enable row level security;
create policy "public reads published posts" on public.madar_posts
  for select to anon, authenticated using (status = 'published' and published_at <= now());

create table public.madar_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  source text not null default '' check (char_length(source) <= 120),
  created_at timestamptz not null default now()
);
create unique index madar_subscribers_email on public.madar_subscribers (lower(email));
comment on table public.madar_subscribers is 'Madar Thursday newsletter sign-ups.';
alter table public.madar_subscribers enable row level security;
create policy "public can subscribe" on public.madar_subscribers for insert to anon with check (true);

create table public.madar_pitches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 200),
  topic text not null check (topic in ('product', 'agile', 'dev', 'design', 'social', 'it')),
  title text not null check (char_length(title) between 1 and 200),
  outline text not null default '' check (char_length(outline) <= 4000),
  links text not null default '' check (char_length(links) <= 1000),
  status text not null default 'new' check (status in ('new', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);
comment on table public.madar_pitches is 'Madar "write with us" article proposals.';
alter table public.madar_pitches enable row level security;
create policy "public can pitch" on public.madar_pitches for insert to anon with check (status = 'new');

grant select on public.madar_posts to anon;
grant insert on public.madar_subscribers, public.madar_pitches to anon;
