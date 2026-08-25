-- Хэрэглэгч, зоос, төлбөр
-- Зоосны ҮНЭН нь coin_ledger. users.coins бол хурдан унших кэш —
-- хоёулаа заавал нэг transaction дотор хамт бичигдэнэ.

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  display_name  text not null,
  -- "daaluu#7204" маягийн танигдах код
  player_code   text unique not null,
  coins         integer not null default 0 check (coins >= 0),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz
);

create index users_player_code_idx on users (player_code);

-- Зоосны бүх хөдөлгөөн. Хэзээ ч устгахгүй, зөвхөн нэмнэ.
create table coin_ledger (
  id            bigserial primary key,
  user_id       uuid not null references users (id) on delete cascade,
  kind          text not null check (kind in ('purchase', 'room_buy', 'bonus', 'refund', 'admin')),
  -- Нэмэгдвэл эерэг, зарцуулбал сөрөг
  amount        integer not null check (amount <> 0),
  balance_after integer not null check (balance_after >= 0),
  payment_id    bigint,
  room_id       uuid,
  note          text,
  created_at    timestamptz not null default now()
);

create index coin_ledger_user_idx on coin_ledger (user_id, created_at desc);

-- QPay нэхэмжлэх. Мерчант эрх авах хүртэл mock-оор дүүргэнэ,
-- бүтэц нь бодит QPay-ийн хариутай ижил.
create table payments (
  id              bigserial primary key,
  user_id         uuid not null references users (id) on delete cascade,
  pack_coins      integer not null check (pack_coins > 0),
  price_mnt       integer not null check (price_mnt > 0),
  -- QPay-ээс ирэх талбарууд
  qpay_invoice_id text,
  qr_text         text,
  qr_image        text,
  -- Банк тус бүрийн deeplink: [{"name":"Хаан банк","link":"khanbank://...","logo":"..."}]
  bank_urls       jsonb not null default '[]'::jsonb,
  status          text not null default 'pending'
                  check (status in ('pending', 'paid', 'expired', 'failed', 'canceled')),
  paid_at         timestamptz,
  callback_raw    jsonb,
  expires_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index payments_user_idx on payments (user_id, created_at desc);
create index payments_status_idx on payments (status) where status = 'pending';
create unique index payments_qpay_invoice_idx on payments (qpay_invoice_id)
  where qpay_invoice_id is not null;

-- Ledger-ийн холбоосыг payments үүссэний дараа нэмнэ
alter table coin_ledger
  add constraint coin_ledger_payment_fk
  foreign key (payment_id) references payments (id) on delete set null;
