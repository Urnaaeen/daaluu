-- Профайлын статистик ба түүх. Тусдаа хүснэгт барихгүй —
-- дууссан тоглолтуудаас шууд тооцно, ингэснээр хэзээ ч зөрөхгүй.

create view user_stats as
select
  mp.user_id,
  count(*)                                             as plays,
  count(*) filter (where mp.place = 1)                 as wins,
  coalesce(
    round(100.0 * count(*) filter (where mp.place = 1) / nullif(count(*), 0)),
    0
  )::integer                                           as win_rate,
  coalesce(sum(mp.final_score), 0)::integer            as total_score
from match_players mp
join matches m on m.id = mp.match_id
where mp.user_id is not null
  and m.status = 'finished'
group by mp.user_id;

-- Профайлын "ТОГЛОСОН ТҮҮХ" жагсаалт
create view user_match_history as
select
  mp.user_id,
  m.id                as match_id,
  m.mode,
  m.ended_at,
  mp.place,
  mp.final_score,
  mp.tsai,
  mp.avlaga,
  mp.uglug,
  mp.ger,
  r.name              as room_name,
  (select count(*) from match_players x where x.match_id = m.id) as player_count
from match_players mp
join matches m on m.id = mp.match_id
left join rooms r on r.id = m.room_id
where mp.user_id is not null
  and m.status = 'finished'
order by m.ended_at desc;
