-- Бүртгүүлэхийн өмнө и-мэйл рүү илгээх 6 оронтой баталгаажуулах код.
-- Кодыг өөрийг нь биш, HMAC-ийг нь хадгална.
create table email_codes (
  email        text primary key,
  code_hash    text not null,
  expires_at   timestamptz not null,
  -- Буруу оруулсан тоо — 5 хүрвэл код хүчингүй
  attempts     integer not null default 0,
  sent_at      timestamptz not null default now(),
  -- Цагт илгээх хязгаар
  window_start timestamptz not null default now(),
  send_count   integer not null default 1
);

alter table users add column email_verified_at timestamptz;
