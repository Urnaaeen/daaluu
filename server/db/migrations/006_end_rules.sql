-- Тоглоомын төгсгөлийн дүрэм.
-- Тоглолт үүсгэсэн тоглогч (өрөөний эзэн / санамсаргүйн эхний хүн) сонгоно.
--   single  — нэг л удаа хуваана, тэр гар дуусмагц дүгнэнэ
--   hands10 — 10 удаа мод хуваана (10 майхан)
--   tsai10  — цай + авлага − өглөг = 10 болмогц дуусна
--   uglug6  — хэн нэгэн 6-аас дээш өглөгтэй болмогц дуусна

alter table matches
  add column end_rule text not null default 'single'
    check (end_rule in ('single', 'hands10', 'tsai10', 'uglug6'));

-- Хэдэн удаа мод хуваасныг тоолно (1-ээс эхэлнэ)
alter table matches
  add column maikhan_no integer not null default 0;

comment on column matches.end_rule is 'Тоглоом дуусах нөхцөл — тоглолт эхлэхийн өмнө сонгогдоно';
comment on column matches.maikhan_no is 'Хэдэн удаа мод хуваасан — hands10 дүрэмд ашиглагдана';
