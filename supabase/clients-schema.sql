-- Client portal: companies Nawa manages, the people who can sign in for them, and one-time codes.
-- Only the server (service key) touches these tables: row-level security is on with no policies.

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text not null default '',
  city text not null default '',
  phone text not null default '',
  website text not null default '',
  notes text not null default '',
  fb_page_id text,              -- the client's Facebook Page, once Nawa has access to it
  ig_user_id text,              -- its Instagram business account (read from the Page)
  platforms jsonb not null default '{}'::jsonb,  -- LinkedIn / TikTok status set by Nawa: { linkedin: { status, url, note } }
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_users (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null default '',
  email text not null unique check (email = lower(email)),
  phone text not null default '',
  role text not null default 'owner' check (role in ('owner', 'member')),
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists client_users_client on client_users(client_id);

-- One pending sign-in code per email (hashed), with attempt and send limits.
create table if not exists client_otps (
  email text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  sends int not null default 1,
  window_start timestamptz not null default now(),
  sent_at timestamptz not null default now()
);

alter table clients enable row level security;
alter table client_users enable row level security;
alter table client_otps enable row level security;

-- The client's Claude connector: one private link per client (only its hash is stored).
-- Claude can read the client's calendar and create draft proposals; the client approves them.
create table if not exists client_ai_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references clients(id) on delete cascade,
  token_hash text not null unique,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  drafts_total integer not null default 0,
  day text not null default '',           -- YYYY-MM-DD of day_count
  day_count integer not null default 0,   -- drafts created that day (limit)
  digest_at timestamptz                   -- last daily email about new proposals
);
alter table client_ai_links enable row level security;
