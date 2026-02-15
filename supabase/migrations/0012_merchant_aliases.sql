create table if not exists public.merchant_aliases (
  id bigserial primary key,
  pattern text not null,
  normalized text not null,
  kind_hint text null,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_merchant_aliases_pattern
on public.merchant_aliases (pattern);

alter table public.merchant_aliases enable row level security;

insert into public.merchant_aliases (pattern, normalized, kind_hint) values
  ('apple.com/bill', 'APPLE', 'subscription'),
  ('app store', 'APPLE', 'subscription'),
  ('paypal *netflix', 'NETFLIX', 'subscription'),
  ('paypal *hulu', 'HULU', 'subscription'),
  ('google *services', 'GOOGLE SERVICES', 'subscription'),
  ('amzn prime', 'AMAZON PRIME', 'subscription')
on conflict (pattern) do nothing;
