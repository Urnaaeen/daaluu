-- Гарын түүх (хажуугийн самбар): тухайн майхны гаруудыг ялгахын тулд
-- гар бүр аль майханд тоглогдсоныг хадгална.
alter table match_rounds add column maikhan_no integer;

comment on column match_rounds.maikhan_no is 'Аль майханд тоглогдсон гар — гарын түүхэд одоогийн майхныг шүүнэ';
