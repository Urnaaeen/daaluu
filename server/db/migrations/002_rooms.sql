-- Худалдаж авсан байнгын өрөө ба урисан гишүүд

create table rooms (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references users (id) on delete cascade,
  name       text not null,
  -- Найзууд оруулж холбогдох 4 оронтой код
  code       char(4) not null unique,
  -- Аль ledger бичилтээр худалдаж авсан
  bought_tx  bigint references coin_ledger (id) on delete set null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create index rooms_owner_idx on rooms (owner_id) where is_active;

-- Ledger дэх room_id-г одоо холбоно
alter table coin_ledger
  add constraint coin_ledger_room_fk
  foreign key (room_id) references rooms (id) on delete set null;

-- Өрөөнд уригдсан тоглогчид
create table room_members (
  room_id    uuid not null references rooms (id) on delete cascade,
  user_id    uuid not null references users (id) on delete cascade,
  status     text not null default 'invited'
             check (status in ('invited', 'joined', 'removed')),
  invited_at timestamptz not null default now(),
  joined_at  timestamptz,
  primary key (room_id, user_id)
);

create index room_members_user_idx on room_members (user_id) where status <> 'removed';
