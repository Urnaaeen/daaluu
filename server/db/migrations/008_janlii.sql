-- Жанлий.
-- Өмнө нь Нохой байнга хамгийн том (rank 16, өнгөгүй) байсан. Одооноос:
--   * Майхан бүрийн эхэнд ээлжлэн нэг тоглогч 8 модноос жанлий сонгоно
--   * Сонгогдсон мод тэр майхны турш бүх модыг дийлж, аль ч өнгөн дээр тавигдана
--   * Бусад мод (Нохой ч) нүдний тоогоороо эрэмбэлэгдэнэ

-- Нохой: 6 улаан нүдтэй энгийн мод
update tile_types set rank = 6, color = 'ulaan' where type_id = 'ulaan_zurgaa_Нохой';

-- 'janlii' — жанлий сонгож байна (гар хэнд ч харагдахгүй), 'play' — тоглож байна
alter table matches
  add column phase text not null default 'play' check (phase in ('janlii', 'play')),
  add column janlii text references tile_types (type_id);

comment on column matches.phase is 'janlii: майхны эхэнд жанлий сонгож байна; play: мод гаргаж байна';
comment on column matches.janlii is 'Тухайн майхны жанлий модны type_id';
