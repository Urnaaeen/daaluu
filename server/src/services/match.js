import { withTransaction } from "../db.js";
import { chooseBotMove, firstLegalMove } from "../game/bot.js";
import { isEndRule, shouldEnd } from "../game/endRules.js";
import { canLead, currentLead, nextLeader, roundWinner, validateMove } from "../game/rules.js";
import { rankPlayers, runTrading } from "../game/trading.js";
import { dealHands, describeAll } from "../game/tiles.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";

const SEATS = 5;
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

const loadHands = async (client, matchId) => {
  const { rows } = await client.query(
    "select seat, tiles from match_hands where match_id = $1",
    [matchId]
  );
  const bySeat = {};
  for (const r of rows) bySeat[r.seat] = describeAll(r.tiles) ?? [];
  return bySeat;
};

const loadRoundMoves = async (client, matchId, roundNo) => {
  const { rows } = await client.query(
    `select seat, tiles, is_secret from match_moves
      where match_id = $1 and round_no = $2 order by played_at`,
    [matchId, roundNo]
  );
  return rows.map((r) => ({
    seat: r.seat,
    tiles: describeAll(r.tiles) ?? [],
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

    const hands = dealHands();
    for (let seat = 0; seat < SEATS; seat++) {
      await writeHand(client, matchId, seat, hands[seat]);
    }

    // Гар нээх эрхтэй эхний суудлаас эхэлнэ — эрхгүй хүн дээр ээлж гацахгүй
    const described = hands.map((h) => describeAll(h) ?? []);
    const firstLeader = [0, 1, 2, 3, 4].find((s) => canLead(described[s])) ?? 0;

    const { rows } = await client.query(
      `update matches
          set status = 'playing', started_at = now(), round_no = 1, maikhan_no = 1,
              current_seat = $2, center = '[]'::jsonb, turn_deadline = $3
        where id = $1 returning *`,
      [matchId, firstLeader, setDeadline(match.turn_seconds)]
    );

    // Эхлэгч бот бол шууд тоглож эхэлнэ
    await advanceBots(client, matchId);

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
  const hands = await loadHands(client, match.id);
  const moves = await loadRoundMoves(client, match.id, match.round_no);

  if (moves.some((m) => m.seat === seat)) {
    throw badRequest("already_played", "Энэ гарт аль хэдийн мод гаргасан.");
  }

  const lead = currentLead(moves);
  const result = validateMove({ hand: hands[seat] ?? [], tileIds, lead });
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
const advanceBots = async (client, matchId) => {
  const events = [];

  for (let guard = 0; guard < 500; guard++) {
    const { rows } = await client.query("select * from matches where id = $1", [matchId]);
    const match = rows[0];
    if (!match || match.status !== "playing") break;

    const players = await loadPlayers(client, matchId);
    const seatRow = players.find((p) => p.seat === match.current_seat);
    // Хүний ээлж — зогсоно
    if (!seatRow || seatRow.user_id) break;

    const hands = await loadHands(client, matchId);
    const moves = await loadRoundMoves(client, matchId, match.round_no);
    const tileIds = chooseBotMove(hands[match.current_seat] ?? [], currentLead(moves));
    if (!tileIds) break;

    const result = await applyMove(client, match, match.current_seat, tileIds);
    events.push({ seat: match.current_seat, tiles: tileIds, ...result });
  }

  return events;
};

export const playTiles = ({ matchId, userId, tileIds }) =>
  withTransaction(async (client) => {
    const match = await lockMatch(client, matchId);
    if (match.status !== "playing") throw badRequest("not_playing", "Тоглолт идэвхгүй байна.");

    const players = await loadPlayers(client, matchId);
    const me = players.find((p) => p.user_id === userId);
    if (!me) throw forbidden("not_in_match", "Та энэ тоглолтод байхгүй байна.");
    if (me.seat !== match.current_seat) throw badRequest("not_your_turn", "Таны ээлж биш байна.");

    const result = await applyMove(client, match, me.seat, tileIds);
    const botMoves = await advanceBots(client, matchId);

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

    const hands = await loadHands(client, match.id);
    const moves = await loadRoundMoves(client, match.id, match.round_no);
    const tileIds = firstLegalMove(hands[match.current_seat] ?? [], currentLead(moves));
    if (!tileIds) return { skipped: true };

    const result = await applyMove(client, match, match.current_seat, tileIds);
    const botMoves = await advanceBots(client, match.id);

    return { autoPlayed: { seat: match.current_seat, tiles: tileIds }, ...result, botMoves };
  });

/* ─────────── гар дүгнэх ─────────── */

const settleRound = async (client, match, moves) => {
  const winner = roundWinner(moves);

  await client.query(
    `insert into match_rounds (match_id, round_no, winner_seat, was_pair)
     values ($1, $2, $3, $4)`,
    [match.id, match.round_no, winner.seat, winner.wasPair]
  );

  await client.query(
    "update match_players set ger = ger + $3 where match_id = $1 and seat = $2",
    [match.id, winner.seat, winner.gained]
  );

  const hands = await loadHands(client, match.id);
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
    // Шинэ майхан — мод дахин тараана, оноо хэвээр
    const hands = dealHands();
    for (let seat = 0; seat < SEATS; seat++) {
      await writeHand(client, match.id, seat, hands[seat]);
    }

    const described = hands.map((h) => describeAll(h) ?? []);
    const firstLeader = [0, 1, 2, 3, 4].find((s) => canLead(described[s])) ?? 0;

    await client.query(
      `update matches
          set round_no = round_no + 1, maikhan_no = maikhan_no + 1, current_seat = $2,
              center = '[]'::jsonb, turn_deadline = $3
        where id = $1`,
      [match.id, firstLeader, setDeadline(match.turn_seconds)]
    );

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

  let hand = [];
  if (me) {
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
    moves: moves.rows.map((m) => ({ seat: m.seat, tiles: m.tiles, isSecret: m.is_secret })),
    mySeat: me?.seat ?? null,
    myHand: hand,
  };
};
