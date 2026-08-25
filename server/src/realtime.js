import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { config } from "./config.js";
import { pool } from "./db.js";
import { autoPlayTimedOut, getMatchState, startMatchFromQueue } from "./services/match.js";
import {
  drainQueue,
  getQueue,
  inQueue,
  joinQueue,
  leaveQueue,
  QUEUE_SIZE,
  setQueueRule,
} from "./services/matchmaking.js";

let io = null;

const roomOf = (matchId) => `match:${matchId}`;

/** Дараалалд байгаа бүх хүн нэг өрөөнд — төлөв өөрчлөгдөх бүрт цацна */
const QUEUE_ROOM = "queue";

export const broadcastQueue = () => {
  io?.to(QUEUE_ROOM).emit("queue:update", getQueue());
};

/** Хэрэглэгч тус бүрийн хувийн өрөө — нэрлэн дуудахад ашиглана */
const userRoom = (userId) => `user:${userId}`;

/**
 * Дараалал бүрдсэн эсэхийг шалгаж, бүрдсэн бол тоглолт үүсгэнэ.
 * Дарааллыг ЭХЛЭЭД синхроноор хоослоно — тэгснээр зэрэг ирсэн
 * хүсэлт хоёр тоглолт үүсгэхгүй.
 */
const tryStartFromQueue = async ({ force = false } = {}) => {
  const state = getQueue();
  if (!force && state.size < QUEUE_SIZE) return null;
  if (state.size === 0) return null;

  const { players, endRule } = drainQueue();
  broadcastQueue();

  try {
    const matchId = await startMatchFromQueue({ players, endRule });
    for (const p of players) {
      io?.to(userRoom(p.userId)).emit("queue:matched", { matchId });
    }
    return matchId;
  } catch (err) {
    console.error("❌ Дараалалаас тоглолт үүсгэж чадсангүй:", err.message);
    for (const p of players) {
      io?.to(userRoom(p.userId)).emit("queue:error", {
        error: err.code ?? "match_failed",
        message: err.userMessage ?? "Тоглолт үүсгэж чадсангүй. Дахин оролдоно уу.",
      });
    }
    return null;
  }
};

/**
 * Онлайн байгаа хэрэглэгчид.
 * Нэг хүн олон төхөөрөмжөөс холбогдож болох тул хэрэглэгч тутам
 * холболтын тоог хадгална — бүгд таслагдмагц л офлайн болно.
 */
const onlineUsers = new Map();

export const getOnlineCount = () => onlineUsers.size;

const broadcastPresence = () => {
  io?.emit("presence", { online: onlineUsers.size });
};

const addOnline = (userId) => {
  onlineUsers.set(userId, (onlineUsers.get(userId) ?? 0) + 1);
  broadcastPresence();
};

const removeOnline = (userId) => {
  const left = (onlineUsers.get(userId) ?? 1) - 1;
  if (left <= 0) onlineUsers.delete(userId);
  else onlineUsers.set(userId, left);
  broadcastPresence();
};

/**
 * Тоглогч бүрийн ГАР ӨӨР тул нэг мэдээллийг бүгд рүү цацаж болохгүй.
 * Тухайн өрөөнд байгаа socket бүрт өөрийнх нь төлөвийг тусад нь илгээнэ.
 */
export const broadcastMatch = async (matchId) => {
  if (!io) return;

  const sockets = await io.in(roomOf(matchId)).fetchSockets();
  if (!sockets.length) return;

  // Нэг хэрэглэгч олон төхөөрөмжөөс холбогдож болно — хэрэглэгч тутамд нэг л уншина
  const cache = new Map();

  for (const socket of sockets) {
    const userId = socket.data.userId;
    if (!cache.has(userId)) {
      try {
        cache.set(userId, await getMatchState(pool, matchId, userId));
      } catch {
        cache.set(userId, null);
      }
    }
    const state = cache.get(userId);
    if (state) socket.emit("match:state", state);
  }
};

export const attachRealtime = (server) => {
  io = new Server(server, {
    cors: {
      origin: config.corsOrigins.length ? config.corsOrigins : true,
      credentials: true,
    },
  });

  // Холбогдохын өмнө токеныг шалгана
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("no_token"));
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("bad_token"));
    }
  });

  io.on("connection", (socket) => {
    addOnline(socket.data.userId);
    socket.join(userRoom(socket.data.userId));

    // Шинээр холбогдсон хүнд одоогийн тоог шууд хэлнэ
    socket.emit("presence", { online: onlineUsers.size });

    socket.on("disconnect", () => {
      removeOnline(socket.data.userId);

      // Салсан хүн дарааллаас автоматаар гарна.
      // Өөр төхөөрөмжөөс холбогдсон хэвээр бол дарааллаас гаргахгүй.
      if (!onlineUsers.has(socket.data.userId) && inQueue(socket.data.userId)) {
        const { changed } = leaveQueue(socket.data.userId);
        if (changed) broadcastQueue();
      }
    });

    /* ── Санамсаргүй тоглогчийн дараалал ── */

    socket.on("queue:join", async (_payload, ack) => {
      try {
        const { rows } = await pool.query(
          "select display_name, player_code from users where id = $1",
          [socket.data.userId]
        );
        if (!rows.length) return ack?.({ ok: false, error: "user_not_found" });

        socket.join(QUEUE_ROOM);
        const { changed, state } = joinQueue({
          userId: socket.data.userId,
          name: rows[0].display_name,
          playerCode: rows[0].player_code,
        });

        ack?.({ ok: true, state });
        if (changed) broadcastQueue();
        else socket.emit("queue:update", state);

        // 5 бүрдсэн бол тоглолт өөрөө эхэлнэ
        if (state.size >= QUEUE_SIZE) await tryStartFromQueue();
      } catch (err) {
        ack?.({ ok: false, error: err.code ?? "join_failed" });
      }
    });

    /**
     * "Хүлээхгүй, ботоор нөхөх" — дараалалд байгаа бүх хүнийг аваад
     * үлдсэн суудлыг ботоор дүүргэж шууд эхлүүлнэ.
     */
    socket.on("queue:fillWithBots", async (_payload, ack) => {
      if (!inQueue(socket.data.userId)) {
        return ack?.({ ok: false, error: "not_in_queue" });
      }
      const matchId = await tryStartFromQueue({ force: true });
      ack?.(matchId ? { ok: true, matchId } : { ok: false, error: "match_failed" });
    });

    socket.on("queue:leave", (_payload, ack) => {
      const { changed, state } = leaveQueue(socket.data.userId);
      socket.leave(QUEUE_ROOM);
      ack?.({ ok: true, state });
      if (changed) broadcastQueue();
    });

    // Төгсгөлийн дүрмийг зөвхөн дараалалд эхэлж орсон хүн сонгоно
    socket.on("queue:setRule", (payload, ack) => {
      const { changed, error, state } = setQueueRule(socket.data.userId, payload?.endRule);
      ack?.({ ok: !error, error, state });
      if (changed) broadcastQueue();
    });

    socket.on("match:join", async (matchId, ack) => {
      try {
        // Төлөв уншиж чадаж байвал л өрөөнд оруулна
        const state = await getMatchState(pool, matchId, socket.data.userId);
        socket.join(roomOf(matchId));
        socket.emit("match:state", state);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err.code ?? "join_failed" });
      }
    });

    socket.on("match:leave", (matchId) => {
      socket.leave(roomOf(matchId));
    });
  });

  return io;
};

/**
 * Ээлжийн хугацаа дууссан тоглолтуудыг цэвэрлэнэ.
 * Хугацаа дуусахад хамгийн бага үнэтэй хүчинтэй мод автоматаар гарна.
 */
export const startTurnTimer = () => {
  const tick = async () => {
    try {
      const { rows } = await pool.query(
        `select id from matches
          where status = 'playing'
            and turn_deadline is not null
            and turn_deadline < now()`
      );

      for (const row of rows) {
        try {
          const result = await autoPlayTimedOut(row.id);
          if (!result.skipped) await broadcastMatch(row.id);
        } catch (err) {
          console.error(`⏱ ${row.id} автомат гаргалт амжилтгүй:`, err.message);
        }
      }
    } catch (err) {
      console.error("⏱ Таймер алдаа:", err.message);
    }
  };

  const timer = setInterval(tick, 2000);
  timer.unref?.();
  return timer;
};
