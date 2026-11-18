import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../lib/auth.js";
import { badRequest, wrap } from "../lib/errors.js";
import { END_RULES, GAMER_UNLOCK_WINS } from "../game/endRules.js";
import { broadcastMatch, notifyUsers, scheduleBots, scheduleBotsAfter } from "../realtime.js";
import {
  createMatch,
  getMatchState,
  joinMatch,
  chooseJanlii,
  playTiles,
  startMatch,
} from "../services/match.js";

const router = Router();

router.use(requireAuth);

// Төгсгөлийн дүрмүүд + Gamer хувилбар нээгдсэн эсэх
router.get(
  "/end-rules",
  wrap(async (req, res) => {
    const { rows } = await pool.query(
      "select coalesce(wins, 0)::int as wins from user_stats where user_id = $1",
      [req.user.id]
    );
    const wins = rows[0]?.wins ?? 0;

    res.json({
      rules: END_RULES,
      gamer: {
        unlocked: wins >= GAMER_UNLOCK_WINS,
        wins,
        required: GAMER_UNLOCK_WINS,
      },
    });
  })
);

// Тоглолт үүсгэх
router.post(
  "/",
  wrap(async (req, res) => {
    const match = await createMatch({
      hostUserId: req.user.id,
      mode: String(req.body?.mode ?? "friends"),
      roomId: req.body?.roomId ?? null,
      turnSeconds: Number(req.body?.turnSeconds ?? 20),
      endRule: String(req.body?.endRule ?? "single"),
    });
    res.status(201).json({ matchId: match.id, status: match.status, endRule: match.end_rule });

    // Найзын өрөө бол гишүүдэд "тоглолт нээгдлээ" гэж мэдэгдэнэ
    if (match.room_id) {
      const { rows } = await pool.query(
        `select m.user_id, r.name as room_name
           from room_members m join rooms r on r.id = m.room_id
          where m.room_id = $1 and m.status <> 'removed'`,
        [match.room_id]
      );
      notifyUsers(
        rows.map((r) => r.user_id),
        "room:match",
        {
          matchId: match.id,
          roomId: match.room_id,
          roomName: rows[0]?.room_name ?? "",
          hostName: req.user.display_name,
        }
      );
    }
  })
);

// Нэгдэх
router.post(
  "/:id/join",
  wrap(async (req, res) => {
    const { seat } = await joinMatch({ matchId: req.params.id, userId: req.user.id });
    res.json({ seat });
    broadcastMatch(req.params.id).catch(() => {});
  })
);

// Эхлүүлэх (зөвхөн хост) — сервер мод тараана
router.post(
  "/:id/start",
  wrap(async (req, res) => {
    await startMatch({ matchId: req.params.id, userId: req.user.id });
    const state = await getMatchState(pool, req.params.id, req.user.id);
    res.json(state);
    // Бусад тоглогч руу тус бүрийн төлөвийг илгээнэ
    broadcastMatch(req.params.id).catch(() => {});
    scheduleBots(req.params.id);
  })
);

// Мод гаргах
router.post(
  "/:id/play",
  wrap(async (req, res) => {
    const tileIds = req.body?.tiles;
    if (!Array.isArray(tileIds)) throw badRequest("no_tiles", "Мод сонгоно уу.");

    const result = await playTiles({
      matchId: req.params.id,
      userId: req.user.id,
      tileIds: tileIds.map(String),
    });

    const state = await getMatchState(pool, req.params.id, req.user.id);
    res.json({ ...state, result });
    broadcastMatch(req.params.id).catch(() => {});
    scheduleBotsAfter(req.params.id, result);
  })
);

// Жанлий сонгох — зөвхөн тухайн майхны сонгогч
router.post(
  "/:id/janlii",
  wrap(async (req, res) => {
    const typeId = req.body?.typeId;
    if (!typeId) throw badRequest("no_janlii", "Жанлий сонгоно уу.");

    const result = await chooseJanlii({
      matchId: req.params.id,
      userId: req.user.id,
      typeId: String(typeId),
    });

    const state = await getMatchState(pool, req.params.id, req.user.id);
    res.json({ ...state, result });
    broadcastMatch(req.params.id).catch(() => {});
    scheduleBots(req.params.id);
  })
);

// Төлөв унших — зөвхөн өөрийн гар ирнэ
router.get(
  "/:id",
  wrap(async (req, res) => {
    const state = await getMatchState(pool, req.params.id, req.user.id);
    res.json(state);
  })
);

export default router;
