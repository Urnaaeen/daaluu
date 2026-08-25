-- Тоглолт. "Тоглож байгаа" ба "түүх" нь ИЖИЛ мөрүүд —
-- дуусахад status='finished' болгоно, өөр газар хуулахгүй.
-- Боттой тоглолтыг бүртгэхгүй тул mode нь зөвхөн онлайн хоёр төрөл.

create table matches (
  id             uuid primary key default gen_random_uuid(),
  -- 'friends' бол өрөөтэй, 'random' бол өрөөгүй
  room_id        uuid references rooms (id) on delete set null,
  mode           text not null check (mode in ('random', 'friends')),
  status         text not null default 'lobby'
                 check (status in ('lobby', 'playing', 'finished', 'abandoned')),
  turn_seconds   integer not null default 20 check (turn_seconds >= 0),
  -- Явцын байдал
  current_seat   smallint check (current_seat between 0 and 4),
  turn_deadline  timestamptz,
  round_no       integer not null default 0,
  -- Голд байгаа мод: [{"seat":1,"tiles":["ulaan_daaluu_Даалуу_1"]}]
  center         jsonb not null default '[]'::jsonb,
  winner_user_id uuid references users (id) on delete set null,
  created_at     timestamptz not null default now(),
  started_at     timestamptz,
  ended_at       timestamptz
);

create index matches_room_idx on matches (room_id);
create index matches_active_idx on matches (status) where status in ('lobby', 'playing');

-- Суудал бүр. Оноо явцад шинэчлэгдэж, дуусахад final_score/place бичигдэнэ.
create table match_players (
  match_id    uuid not null references matches (id) on delete cascade,
  seat        smallint not null check (seat between 0 and 4),
  -- Бот бол user_id null
  user_id     uuid references users (id) on delete set null,
  bot_name    text,
  is_host     boolean not null default false,
  connected   boolean not null default true,
  -- Явцын оноо
  tsai        integer not null default 2,
  avlaga      integer not null default 0,
  uglug       integer not null default 0,
  ger         integer not null default 0,
  -- Эцсийн дүн
  final_score integer,
  place       smallint check (place between 1 and 5),
  primary key (match_id, seat),
  -- Бот эсвэл хэрэглэгч — аль нэг нь заавал
  constraint match_players_who check (user_id is not null or bot_name is not null)
);

-- Нэг хүн нэг тоглолтод нэг суудал
create unique index match_players_user_idx on match_players (match_id, user_id)
  where user_id is not null;
create index match_players_history_idx on match_players (user_id) where place is not null;

-- НУУЦ: тоглогчийн гарт байгаа мод.
-- Тусдаа хүснэгт болгосон учир нь: API зөвхөн эзэнд нь буцаана,
-- дараа Supabase руу шилжвэл нэг RLS policy-гоор хаана.
create table match_hands (
  match_id uuid not null references matches (id) on delete cascade,
  seat     smallint not null check (seat between 0 and 4),
  -- ["ulaan_daaluu_Даалуу_1", "tsagaan_uuluu_Үүлүү_2", ...]
  tiles    jsonb not null default '[]'::jsonb,
  primary key (match_id, seat)
);

-- Гар бүрт хийсэн явц. "Гарын түүх" самбарыг энэ тэжээнэ.
create table match_moves (
  id         bigserial primary key,
  match_id   uuid not null references matches (id) on delete cascade,
  round_no   integer not null,
  seat       smallint not null check (seat between 0 and 4),
  tiles      jsonb not null,
  -- Хосгүй 2 мод гаргасан — нууц мод болсон
  is_secret  boolean not null default false,
  played_at  timestamptz not null default now()
);

create index match_moves_round_idx on match_moves (match_id, round_no, seat);
-- Нэг тоглогч нэг гарт нэг л удаа мод гаргана
create unique index match_moves_once_idx on match_moves (match_id, round_no, seat);

-- Гар бүрийн дүн
create table match_rounds (
  match_id    uuid not null references matches (id) on delete cascade,
  round_no    integer not null,
  winner_seat smallint not null check (winner_seat between 0 and 4),
  -- Хосоор ялсан бол 2 гэр
  was_pair    boolean not null default false,
  ended_at    timestamptz not null default now(),
  primary key (match_id, round_no)
);
