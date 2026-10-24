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

-- «تخزين نواة» prepaid balance: a ledger (balance = sum) and the top-up requests with their receipts.
create table if not exists client_ledger (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  kind text not null check (kind in ('topup', 'usage', 'adjust')),
  amount_dzd numeric(12, 2) not null,           -- + credit, - usage
  ref text,                                     -- 'usage:2026-10-24' | 'payment:<id>': one entry each
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (client_id, ref)
);
create index if not exists client_ledger_client_created on client_ledger (client_id, created_at);

create table if not exists client_payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  amount_dzd integer not null check (amount_dzd > 0 and amount_dzd <= 1000000),
  method text not null,                         -- baridimob | ccp | redotpay | cash | other
  reference text not null default '',
  receipt text,                                 -- the receipt image as a data URL (compressed in the browser)
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason text not null default '',
  source text not null default 'client' check (source in ('client', 'admin')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists client_payments_status on client_payments (status, created_at);
create index if not exists client_payments_client on client_payments (client_id, created_at);

alter table clients add column if not exists wallet_zero_since date;               -- balance reached 0 (grace starts)
alter table clients add column if not exists wallet_alert text not null default ''; -- last alert sent: d7 | d3 | zero | paused | day30

alter table client_ledger enable row level security;
alter table client_payments enable row level security;

-- «تخزين نواة» plans: the client buys N GB for 1/3/6/12 months (replaces the prepaid balance;
-- client_ledger stays only as history).
alter table clients add column if not exists plan_gb integer not null default 0;     -- current plan size
alter table clients add column if not exists plan_until date;                        -- last day of the paid period
alter table clients add column if not exists plan_next_gb integer;                   -- a smaller size chosen at renewal…
alter table clients add column if not exists plan_next_from date;                    -- …applies from this day

alter table client_payments add column if not exists kind text not null default 'topup'
  check (kind in ('topup', 'new', 'renew', 'upgrade'));
alter table client_payments add column if not exists gb integer;                     -- plan size bought
alter table client_payments add column if not exists months integer;                 -- 0 = upgrade only
alter table client_payments add column if not exists discount_pct numeric(5, 2) not null default 0;
alter table client_payments add column if not exists unit_price numeric(10, 2);      -- DZD per GB per month at the time
alter table client_payments add column if not exists upgrade_dzd integer not null default 0; -- part paying the extra GB for the days left
