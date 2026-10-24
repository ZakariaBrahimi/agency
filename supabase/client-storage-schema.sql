-- Client storage and billing. Clients never use Nawa's Google Drive: each one stores media in
-- its own Google Drive (free, capped at 15 GB) and/or «تخزين نواة» (Nawa Cloud, paid per GB-month).
-- Post data (titles, captions, schedule) lives here, whatever the storage.

alter table clients
  add column if not exists drive_conn text,          -- sealed Google refresh token (drive.file scope)
  add column if not exists drive_email text,
  add column if not exists drive_folder text,        -- the «نواة» folder created in the client's Drive
  add column if not exists cloud_enabled boolean not null default false;

-- Each client's post index (same shape as Nawa's Drive index: { version, settings, posts }).
create table if not exists client_content (
  client_id uuid primary key references clients(id) on delete cascade,
  data jsonb not null default '{"version":1,"settings":{},"posts":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Bytes stored per client per day (written by the cron), for GB-month billing.
create table if not exists client_usage_daily (
  client_id uuid not null references clients(id) on delete cascade,
  day date not null,
  cloud_bytes bigint not null default 0,
  drive_bytes bigint not null default 0,
  primary key (client_id, day)
);

-- One invoice per client per month for Nawa Cloud. The price used is kept on the invoice.
create table if not exists client_invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  avg_gb numeric not null,
  price_dzd numeric not null,       -- per GB per month at the time of the invoice
  amount_dzd integer not null,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'void')),
  method text,                      -- baridimob | ccp | redotpay | cash | other
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, month)
);

alter table client_content enable row level security;
alter table client_usage_daily enable row level security;
alter table client_invoices enable row level security;

-- Where new uploads go: auto = the client's Google Drive first, then «تخزين نواة» when full;
-- cloud = always «تخزين نواة» (only when cloud_enabled).
alter table clients add column if not exists storage_pref text not null default 'auto'
  check (storage_pref in ('auto', 'cloud'));
