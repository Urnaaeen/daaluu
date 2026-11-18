import crypto from "node:crypto";
import { withTransaction } from "../db.js";
import { chooseBotMove, firstLegalMove } from "../game/bot.js";
import { isEndRule, shouldEnd } from "../game/endRules.js";
import { currentLead, nextLeader, roundWinner, validateMove } from "../game/rules.js";
import { rankPlayers, runTrading } from "../game/trading.js";
import { dealHands, describeAll, isJanliiOption, JANLII_OPTIONS } from "../game/tiles.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";

const SEATS = 5;
// Жанлий сонгох хугацаа (ээлжийн хугацаанаас үл хамаарна)
const JANLII_SECONDS = Number(process.env.JANLII_SECONDS ?? 30);

/**
 * Ботын хурд. Боттой горим шиг ботууд нэг нэгээрээ, хүмүүст харагдахуйц
 * зайтай тоглоно (realtime.js-ийн scheduleBots). 0 бол хуучин шиг шууд
 * (транзакц дотор) тоглоно — серверийн тестүүдэд.
 */
export const BOT_DELAY_MS = Number(process.env.BOT_DELAY_MS ?? 1200);
/** Гар дуусахад ширээ цэвэрлэгдэхээс өмнө харагдах хугацаа */
export const ROUND_PAUSE_MS = Number(process.env.ROUND_PAUSE_MS ?? 2500);
const BOT_NAMES = ["ХАНДЦООЖ", "ШИЖИР", "ЭНХЛЭН", "УЛАМБАЯР", "БАТ"];

/* ─────────── дотоод туслахууд ─────────── */

const lockMatch = async (client, matchId) => {
  const { rows } = await client.query("select * from matches where id = $1 for update", [matchId]);
  if (!rows.length) throw notFound("match_not_found", "Тоглолт олдсонгүй.");
  return rows[0];
};

const loadPlayers = async (client, matchId) => {
  const { rows } = await client.query(
    "select * from match_players where match_id = $1 order by seat",
    [matchId]
  );
  return rows;
};

const loadHands = async (client, matchId, janlii = null) => {
  const { rows } = await client.query(
    "select seat, tiles from match_hands where match_id = $1",
    [matchId]
  );
  const bySeat = {};
  for (const r of rows) bySeat[r.seat] = describeAll(r.tiles, janlii) ?? [];
  return bySeat;
};

const loadRoundMoves = async (client, matchId, roundNo, janlii = null) => {
  const { rows } = await client.query(
    `select seat, tiles, is_secret from match_moves
      where match_id = $1 and round_no = $2 order by played_at`,
    [matchId, roundNo]
  );
  return rows.map((r) => ({
    seat: r.seat,
    tiles: describeAll(r.tiles, janlii) ?? [],
    isSecret: r.is_secret,
  }));
};

const writeHand = (client, matchId, seat, tiles) =>
  client.query(
    `insert into match_hands (match_id, seat, tiles) values ($1, $2, $3)
     on conflict (match_id, seat) do update set tiles = excluded.tiles`,
    [matchId, seat, JSON.stringify(tiles)]
  );

const setDeadline = (turnSeconds) =>
  turnSeconds > 0 ? new Date(Date.now() + turnSeconds * 1000) : null;

/* ─────────── майхан эхлүүлэх / жанлий ─────────── */

/**
 * Майхны жанлий сонгогч. Хост (0-р суудал: өрөө үүсгэсэн / санамсаргүйн эхний хүн)
 * эхэлж, дараагийн майхан бүрт ээлжлэн шилжинэ.
 */
const janliiChooser = (maikhanNo) => (Math.max(1, maikhanNo) - 1) % SEATS;

/**
 * Шинэ майхан: мод нууцаар тараагаад жанлий сонгох үе рүү орно.
 * Сонголт хийгдэх хүртэл хэн ч гараа харахгүй (getMatchState нууна).
 */
const dealMaikhan = async (client, matchId, maikhanNo) => {
  const hands = dealHands();
  for (let seat = 0; seat < SEATS; seat++) {
    await writeHand(client, matchId, seat, hands[seat]);
  }
  await client.query(
    `update matches
        set phase = 'janlii', janlii = null, current_seat = $2,
            center = '[]'::jsonb, turn_deadline = $3
      where id = $1`,
    [matchId, janliiChooser(maikhanNo), new Date(Date.now() + JANLII_SECONDS * 1000)]
  );
};

/**
 * Жанлийг тогтоож тоглолтыг эхлүүлнэ. Сонгогч өөрөө анх гарна;
 * гараа нээх эрхгүй бол дараагийн эрхтэй суудал (nextLeader-ийн дүрмээр).
 */
const applyJanlii = async (client, match, typeId) => {
  if (!isJanliiOption(typeId)) throw badRequest("bad_janlii", "Ийм жанлий сонгох боломжгүй.");

  const hands = await loadHands(client, match.id, typeId);
  const lead = nextLeader(match.current_seat, hands);
  let leader = lead.seat;
  if (leader === null) {
    leader = lead.highestSeat ?? match.current_seat;
    await client.query(
      "update match_players set ger = ger + 1 where match_id = $1 and seat = $2",
      [match.id, leader]
    );
  }

  await client.query(
    `update matches set phase = 'play', janlii = $2, current_seat = $3, turn_deadline = $4
      where id = $1`,
    [match.id, typeId, leader, setDeadline(match.turn_seconds)]
  );
  return { janlii: typeId, chooserSeat: match.current_seat, leaderSeat: leader };
};

const randomJanlii = () => JANLII_OPTIONS[crypto.randomInt(0, JANLII_OPTIONS.length)];

/** Хүн жанлий сонгоно — зөвхөн тухайн майхны сонгогч, зөвхөн сонгох үед */
export const chooseJanlii = ({ matchId, userId, typeId }) =>
  withTransaction(async (client) => {
    const match = await lockMatch(client, matchId);
    if (match.status !== "playing" || match.phase !== "janlii") {
      throw badRequest("not_janlii_phase", "Одоо жанлий сонгох үе биш байна.");
    }
    const players = await loadPlayers(client, matchId);
    const me = players.find((p) => p.user_id === userId);
    if (!me) throw forbidden("not_in_match", "Та энэ тоглолтод байхгүй байна.");
    if (me.seat !== match.current_seat) {
      throw forbidden("not_janlii_chooser", "Энэ майханд өөр тоглогч жанлий сонгоно.");
    }

    const result = await applyJanlii(client, match, String(typeId));
    const botMoves = await autoBots(client, matchId);
    return { ...result, botMoves };
  });

/* ─────────── тоглолт үүсгэх / нэгдэх ─────────── */

export const createMatch = ({
  hostUserId,
  mode,
  roomId = null,
  turnSeconds = 20,
  endRule = "single",
}) =>
  withTransaction(async (client) => {
    if (!["random", "friends"].includes(mode)) {
      throw badRequest("bad_mode", "Тоглолтын төрөл буруу байна.");
    }
    if (!isEndRule(endRule)) {
      throw badRequest("bad_end_rule", "Төгсгөлийн дүрэм буруу байна.");
    }

    if (mode === "friends") {
      const owned = await client.query("select 1 from rooms where id = $1 and owner_id = $2", [
        roomId,
        hostUserId,
      ]);
      if (!owned.rows.length) throw forbidden("not_room_owner", "Энэ өрөөний эзэн биш байна.");
    }

    const { rows } = await client.query(
      `insert into matches (room_id, mode, turn_seconds, end_rule)
       values ($1, $2, $3, $4) returning *`,
      [mode === "friends" ? roomId : null, mode, turnSeconds, endRule]
    );
    const match = rows[0];

    await client.query(
      `insert into match_players (match_id, seat, user_id, is_host) values ($1, 0, $2, true)`,
      [match.id, hostUserId]
    );

    return match;
  });

export const joinMatch = ({ matchId, userId }) =>
  withTransaction(async (client) => {
    const match = await lockMatch(client, matchId);
    if (match.status !== "lobby") throw badRequest("match_started", "Тоглолт аль хэдийн эхэлсэн.");

    const players = await loadPlayers(client, matchId);

    const mine = players.find((p) => p.user_id === userId);
    if (mine) return { match, seat: mine.seat };

    // Найзын тоглолтод зөвхөн өрөөний гишүүд (кодоор нэгдсэн эсвэл уригдсан) орно
    if (match.mode === "friends") {
      const member = await client.query(
        `select 1 from room_members
          where room_id = $1 and user_id = $2 and status <> 'removed'`,
        [match.room_id, userId]
      );
      if (!member.rows.length) {
        throw forbidden("not_room_member", "Та энэ өрөөний гишүүн биш байна. Өрөөний кодоор нэгдэнэ үү.");
      }
      await client.query(
        `update room_members set status = 'joined', joined_at = coalesce(joined_at, now())
          where room_id = $1 and user_id = $2`,
        [match.room_id, userId]
      );
    }

    const taken = new Set(players.map((p) => p.seat));
    const seat = [0, 1, 2, 3, 4].find((s) => !taken.has(s));
    if (seat === undefined) throw badRequest("match_full", "Тоглолт дүүрсэн байна.");

    await client.query(
      `insert into match_players (match_id, seat, user_id) values ($1, $2, $3)`,
      [matchId, seat, userId]
    );

    return { match, seat };
  });

/**
 * Мод тараах. ЗӨВХӨН сервер тараана — хост ч бусдын модыг харахгүй.
 * Дутуу суудлыг ботоор нөхнө.
 */
export const startMatch = ({ matchId, userId }) =>
  withTransaction(async (client) => {
    const match = await lockMatch(client, matchId);
    if (match.status !== "lobby") throw badRequest("already_started", "Тоглолт аль хэдийн эхэлсэн.");

    const players = await loadPlayers(client, matchId);
    const host = players.find((p) => p.is_host);
    if (!host || host.user_id !== userId) {
      throw forbidden("not_host", "Зөвхөн хост тоглоомыг эхлүүлнэ.");
    }

    // Дутуу суудлыг ботоор дүүргэнэ
    const taken = new Set(players.map((p) => p.seat));
    let botIndex = 0;
    for (let seat = 0; seat < SEATS; seat++) {
      if (taken.has(seat)) continue;
      await client.query(
        `insert into match_players (match_id, seat, bot_name) values ($1, $2, $3)`,
        [matchId, seat, BOT_NAMES[botIndex++ % BOT_NAMES.length]]
      );
    }

    await client.query(
      `update matches set status = 'playing', started_at = now(), round_no = 1, maikhan_no = 1
        where id = $1`,
      [matchId]
    );
    // Мод нууцаар тараагаад хост жанлий сонгоно
    await dealMaikhan(client, matchId, 1);

    // Сонгогч / эхлэгч бот бол шууд үргэлжилнэ
    await autoBots(client, matchId);

    const { rows } = await client.query("select * from matches where id = $1", [matchId]);
    return rows[0];
  });

/**
 * Дараалалд бүрдсэн тоглогчдоор тоглолт үүсгэж, шууд эхлүүлнэ.
 * Эхний хүн хост болно; 5 хүрэхгүй байвал үлдсэн суудлыг бот нөхнө.
 * @param players [{ userId }] — дарааллын эрэмбээр
 */
export const startMatchFromQueue = async ({ players, endRule }) => {
  if (!players.length) throw badRequest("empty_queue", "Дараалал хоосон байна.");

  const host = players[0];
  const match = await createMatch({
    hostUserId: host.userId,
    mode: "random",
    endRule,
    turnSeconds: 20,
  });

  for (const p of players.slice(1, SEATS)) {
    await joinMatch({ matchId: match.id, userId: p.userId });
  }

  await startMatch({ matchId: match.id, userId: host.userId });
  return match.id;
};

/* ─────────── мод гаргах ─────────── */

/**
 * Нэг суудлын хөдөлгөөнийг хэрэгжүүлнэ. Хүн ба бот хоёуланд ижил зам —
 * бот ч дүрмийн шалгалтыг тойрч гарахгүй.
 */
const applyMove = async (client, match, seat, tileIds) => {
  if (match.phase !== "play") throw badRequest("janlii_pending", "Эхлээд жанлий сонгогдох ёстой.");

  const hands = await loadHands(client, match.id, match.janlii);
  const moves = await loadRoundMoves(client, match.id, match.round_no, match.janlii);

  if (moves.some((m) => m.seat === seat)) {
    throw badRequest("already_played", "Энэ гарт аль хэдийн мод гаргасан.");
  }

  const lead = currentLead(moves);
  const result = validateMove({ hand: hands[seat] ?? [], tileIds, lead, janlii: match.janlii });
  if (!result.ok) throw badRequest("illegal_move", result.reason);

  const remaining = (hands[seat] ?? []).filter((t) => !tileIds.includes(t.id));
  await writeHand(client, match.id, seat, remaining.map((t) => t.id));

  await client.query(
    `insert into match_moves (match_id, round_no, seat, tiles, is_secret)
     values ($1, $2, $3, $4, $5)`,
    [match.id, match.round_no, seat, JSON.stringify(tileIds), result.isSecret]
  );

  const allMoves = [...moves, { seat, tiles: result.tiles, isSecret: result.isSecret }];

  // Гар дуусаагүй бол дараагийн суудал руу
  if (allMoves.length < SEATS) {
    await client.query(
      "update matches set current_seat = $2, turn_deadline = $3 where id = $1",
      [match.id, (seat + 1) % SEATS, setDeadline(match.turn_seconds)]
    );
    return { roundEnded: false };
  }

  return settleRound(client, match, allMoves);
};

/**
 * Ээлж бот дээр ирсэн бол сервер тэдний өмнөөс тоглоно.
 * Хүний ээлж ирэх, эсвэл тоглоом дуусах хүртэл үргэлжилнэ.
 */
const advanceBots = async (client, matchId, limit = 500) => {
  const events = [];

  for (let guard = 0; guard < Math.min(500, limit); guard++) {
    const { rows } = await client.query("select * from matches where id = $1", [matchId]);
    const match = rows[0];
    if (!match || match.status !== "playing") break;

    const players = await loadPlayers(client, matchId);
    const seatRow = players.find((p) => p.seat === match.current_seat);
    // Хүний ээлж — зогсоно
    if (!seatRow || seatRow.user_id) break;

    // Бот жанлий сонгогч бол санамсаргүй сонгоно
    if (match.phase === "janlii") {
      const r = await applyJanlii(client, match, randomJanlii());
      events.push({ seat: match.current_seat, janlii: r.janlii });
      continue;
    }

    const hands = await loadHands(client, matchId, match.janlii);
    const moves = await loadRoundMoves(client, matchId, match.round_no, match.janlii);
    const tileIds = chooseBotMove(hands[match.current_seat] ?? [], currentLead(moves), match.janlii);
    if (!tileIds) break;

    const result = await applyMove(client, match, match.current_seat, tileIds);
    events.push({ seat: match.current_seat, tiles: tileIds, ...result });
  }

  return events;
};

/** Ботууд шууд тоглох эсэх — хурдтай горимд хоосон буцааж, scheduleBots-д үлдээнэ */
const autoBots = (client, matchId) => (BOT_DELAY_MS > 0 ? [] : advanceBots(client, matchId));

/**
 * Ээлж бот дээр байвал ЗӨВХӨН нэг алхам (жанлий сонгох эсвэл мод гаргах) хийнэ.
 * realtime.js-ийн scheduleBots үүнийг зайтайгаар дуудна.
 */
export const playOneBot = (matchId) =>
  withTransaction(async (client) => {
    const match = await lockMatch(client, matchId);
    if (match.status !== "playing") return { played: false };
    const [event] = await advanceBots(client, matchId, 1);
    if (!event) return { played: false };
    return { played: true, roundEnded: !!event.roundEnded, event };
  });

export const playTiles = ({ matchId, userId, tileIds }) =>
  withTransaction(async (client) => {
    const match = await lockMatch(client, matchId);
    if (match.status !== "playing") throw badRequest("not_playing", "Тоглолт идэвхгүй байна.");

    const players = await loadPlayers(client, matchId);
    const me = players.find((p) => p.user_id === userId);
    if (!me) throw forbidden("not_in_match", "Та энэ тоглолтод байхгүй байна.");
    if (me.seat !== match.current_seat) throw badRequest("not_your_turn", "Таны ээлж биш байна.");

    const result = await applyMove(client, match, me.seat, tileIds);
    const botMoves = await autoBots(client, matchId);

    return { ...result, botMoves };
  });

/** Ээлжийн хугацаа дууссан суудлын өмнөөс автоматаар мод гаргана */
export const autoPlayTimedOut = (matchId) =>
  withTransaction(async (client) => {
    const match = await lockMatch(client, matchId);
    if (match.status !== "playing") return { skipped: true };
    if (!match.turn_deadline || new Date(match.turn_deadline) > new Date()) {
      return { skipped: true };
    }

    // Жанлий сонгох хугацаа дууслаа — санамсаргүй сонгоно
    if (match.phase === "janlii") {
      const r = await applyJanlii(client, match, randomJanlii());
      const botMoves = await autoBots(client, match.id);
      return { autoJanlii: r, botMoves };
    }

    const hands = await loadHands(client, match.id, match.janlii);
    const moves = await loadRoundMoves(client, match.id, match.round_no, match.janlii);
    const tileIds = firstLegalMove(hands[match.current_seat] ?? [], currentLead(moves), match.janlii);
    if (!tileIds) return { skipped: true };

    const result = await applyMove(client, match, match.current_seat, tileIds);
    const botMoves = await autoBots(client, match.id);

    return { autoPlayed: { seat: match.current_seat, tiles: tileIds }, ...result, botMoves };
  });

/* ─────────── гар дүгнэх ─────────── */

const settleRound = async (client, match, moves) => {
  const winner = roundWinner(moves);

  await client.query(
    `insert into match_rounds (match_id, round_no, winner_seat, was_pair, maikhan_no)
     values ($1, $2, $3, $4, $5)`,
    [match.id, match.round_no, winner.seat, winner.wasPair, match.maikhan_no]
  );

  await client.query(
    "update match_players set ger = ger + $3 where match_id = $1 and seat = $2",
    [match.id, winner.seat, winner.gained]
  );

  const hands = await loadHands(client, match.id, match.janlii);
  const allEmpty = [0, 1, 2, 3, 4].every((s) => (hands[s] ?? []).length === 0);

  // Бүх гар дууслаа — майхан дуусч худалдаа хийгдэнэ
  if (allEmpty) {
    return settleMaikhan(client, match);
  }

  const lead = nextLeader(winner.seat, hands);

  // Хэн ч эхлэх эрхгүй — хамгийн том модтой нь гэр аваад эхэлнэ
  let nextSeat = lead.seat;
  if (nextSeat === null) {
    nextSeat = lead.highestSeat ?? winner.seat;
    await client.query(
      "update match_players set ger = ger + 1 where match_id = $1 and seat = $2",
      [match.id, nextSeat]
    );
  }

  await client.query(
    `update matches
        set round_no = round_no + 1, current_seat = $2,
            center = '[]'::jsonb, turn_deadline = $3
      where id = $1`,
    [match.id, nextSeat, setDeadline(match.turn_seconds)]
  );

  return { roundEnded: true, winnerSeat: winner.seat, gained: winner.gained, nextSeat };
};

/* ─────────── майхан дүгнэх (худалдаа) ─────────── */

const settleMaikhan = async (client, match) => {
  const players = await loadPlayers(client, match.id);

  const { players: traded, trades } = runTrading(
    players.map((p) => ({
      seat: p.seat,
      ger: p.ger,
      tsai: p.tsai,
      avlaga: p.avlaga,
      uglug: p.uglug,
    }))
  );

  for (const p of traded) {
    await client.query(
      `update match_players set ger = 0, tsai = $3, avlaga = $4, uglug = $5
        where match_id = $1 and seat = $2`,
      [match.id, p.seat, p.tsai, p.avlaga, p.uglug]
    );
  }

  // Сонгосон төгсгөлийн дүрмээр дуусах эсэхийг шийднэ
  const end = shouldEnd(match.end_rule, traded, match.maikhan_no);

  if (!end.ended) {
    // Шинэ майхан — мод дахин тараана, оноо хэвээр. Дараагийн тоглогч жанлий сонгоно.
    const nextMaikhan = match.maikhan_no + 1;
    await client.query(
      `update matches set round_no = round_no + 1, maikhan_no = $2 where id = $1`,
      [match.id, nextMaikhan]
    );
    await dealMaikhan(client, match.id, nextMaikhan);

    return { roundEnded: true, maikhanEnded: true, trades, gameEnded: false };
  }

  // Тоглоом дууслаа — байр эрэмбэлж бичнэ
  const ranked = rankPlayers(traded);
  for (const p of ranked) {
    await client.query(
      `update match_players set final_score = $3, place = $4 where match_id = $1 and seat = $2`,
      [match.id, p.seat, p.final_score, p.place]
    );
  }

  const winnerSeat = ranked[0].seat;
  const winnerRow = players.find((p) => p.seat === winnerSeat);

  await client.query(
    `update matches set status = 'finished', ended_at = now(), winner_user_id = $2
      where id = $1`,
    [match.id, winnerRow?.user_id ?? null]
  );

  await client.query("delete from match_hands where match_id = $1", [match.id]);

  return { roundEnded: true, maikhanEnded: true, trades, gameEnded: true, reason: end.reason, ranked };
};

/* ─────────── төлөв унших ─────────── */

/**
 * Тоглолтын төлөв. ЗӨВХӨН дуудсан хүний гарыг буцаана —
 * бусдын мод хэзээ ч клиент рүү явахгүй.
 */
export const getMatchState = async (client, matchId, userId) => {
  const { rows } = await client.query("select * from matches where id = $1", [matchId]);
  if (!rows.length) throw notFound("match_not_found", "Тоглолт олдсонгүй.");
  const match = rows[0];

  const players = await client.query(
    `select mp.seat, mp.user_id, mp.bot_name, mp.is_host, mp.connected,
            mp.tsai, mp.avlaga, mp.uglug, mp.ger, mp.final_score, mp.place,
            u.display_name, u.player_code,
            coalesce(jsonb_array_length(h.tiles), 0) as tiles_left
       from match_players mp
       left join users u on u.id = mp.user_id
       left join match_hands h on h.match_id = mp.match_id and h.seat = mp.seat
      where mp.match_id = $1 order by mp.seat`,
    [matchId]
  );

  const me = players.rows.find((p) => p.user_id === userId);

  const moves = await client.query(
    `select seat, tiles, is_secret from match_moves
      where match_id = $1 and round_no = $2 order by played_at`,
    [matchId, match.round_no]
  );

  // Нууц мод (хосгүй 2 мод) зөвхөн гаргасан хүндээ харагдана — бусдад "nuuts"
  const mask = (seat, tiles, isSecret) =>
    isSecret && seat !== me?.seat ? tiles.map((_, i) => `nuuts_${i + 1}`) : tiles;

  // Гарын түүх — одоогийн майхны дууссан гарууд (хажуугийн самбар)
  const rounds = await client.query(
    `select round_no, winner_seat, was_pair from match_rounds
      where match_id = $1 and maikhan_no = $2 order by round_no`,
    [matchId, match.maikhan_no]
  );
  const roundNos = rounds.rows.map((r) => r.round_no);
  const pastMoves = roundNos.length
    ? await client.query(
        `select round_no, seat, tiles, is_secret from match_moves
          where match_id = $1 and round_no = any($2::int[])`,
        [matchId, roundNos]
      )
    : { rows: [] };
  const history = rounds.rows.map((r) => {
    const plays = [null, null, null, null, null];
    for (const m of pastMoves.rows) {
      if (m.round_no === r.round_no) plays[m.seat] = mask(m.seat, m.tiles, m.is_secret);
    }
    return { roundNo: r.round_no, winnerSeat: r.winner_seat, wasPair: r.was_pair, plays };
  });

  // Сүүлд дууссан гар — шинэ гар/майхан эхэлсэн ч апп ширээн дээр түр харуулна
  const lastRoundRow = (
    await client.query(
      `select round_no, winner_seat, was_pair from match_rounds
        where match_id = $1 order by round_no desc limit 1`,
      [matchId]
    )
  ).rows[0];
  let lastRound = null;
  if (lastRoundRow) {
    const lm = await client.query(
      "select seat, tiles, is_secret from match_moves where match_id = $1 and round_no = $2",
      [matchId, lastRoundRow.round_no]
    );
    const plays = [null, null, null, null, null];
    for (const m of lm.rows) plays[m.seat] = mask(m.seat, m.tiles, m.is_secret);
    lastRound = {
      roundNo: lastRoundRow.round_no,
      winnerSeat: lastRoundRow.winner_seat,
      wasPair: lastRoundRow.was_pair,
      plays,
    };
  }

  // Жанлий сонгогдох хүртэл хэн ч гараа харахгүй ("модоо харахаас өмнө нэрлэнэ")
  let hand = [];
  if (me && match.phase !== "janlii") {
    const h = await client.query(
      "select tiles from match_hands where match_id = $1 and seat = $2",
      [matchId, me.seat]
    );
    hand = h.rows[0]?.tiles ?? [];
  }

  return {
    match: {
      id: match.id,
      mode: match.mode,
      status: match.status,
      roundNo: match.round_no,
      maikhanNo: match.maikhan_no,
      endRule: match.end_rule,
      currentSeat: match.current_seat,
      turnDeadline: match.turn_deadline,
      turnSeconds: match.turn_seconds,
      // 'janlii' үед currentSeat нь жанлий сонгогч, turnDeadline нь сонгох хугацаа
      phase: match.phase,
      janlii: match.janlii,
      janliiOptions: JANLII_OPTIONS,
    },
    // Бусдын талаар: нэр, оноо, үлдсэн модны ТОО — гэхдээ ямар мод болох нь харагдахгүй
    players: players.rows.map((p) => ({
      seat: p.seat,
      name: p.display_name ?? p.bot_name,
      playerCode: p.player_code ?? null,
      isBot: !p.user_id,
      isHost: p.is_host,
      isMe: p.user_id === userId,
      tsai: p.tsai,
      avlaga: p.avlaga,
      uglug: p.uglug,
      ger: p.ger,
      tilesLeft: Number(p.tiles_left),
      place: p.place,
      finalScore: p.final_score,
    })),
    moves: moves.rows.map((m) => ({
      seat: m.seat,
      tiles: mask(m.seat, m.tiles, m.is_secret),
      isSecret: m.is_secret,
    })),
    history,
    lastRound,
    mySeat: me?.seat ?? null,
    myHand: hand,
  };
};
