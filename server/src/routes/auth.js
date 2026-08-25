import { Router } from "express";
import { query, withTransaction } from "../db.js";
import { hashPassword, requireAuth, signToken, verifyPassword } from "../lib/auth.js";
import { badRequest, conflict, unauthorized, wrap } from "../lib/errors.js";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.display_name,
  playerCode: u.player_code,
  coins: u.coins,
});

// Давхцахгүй "daaluu#0000" код олох
const uniquePlayerCode = async (client) => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = `daaluu#${String(Math.floor(1000 + Math.random() * 9000))}`;
    const { rows } = await client.query("select 1 from users where player_code = $1", [code]);
    if (!rows.length) return code;
  }
  throw conflict("code_exhausted", "Тоглогчийн код үүсгэж чадсангүй. Дахин оролдоно уу.");
};

router.post(
  "/register",
  wrap(async (req, res) => {
    const name = String(req.body?.name ?? "").trim();
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");

    if (!name) throw badRequest("no_name", "Тоглогчийн нэрээ оруулна уу.");
    if (!EMAIL_RE.test(email)) throw badRequest("bad_email", "И-мэйл хаяг буруу байна.");
    if (password.length < 6) throw badRequest("weak_password", "Нууц үг дор хаяж 6 тэмдэгт байх ёстой.");

    const exists = await query("select 1 from users where email = $1", [email]);
    if (exists.rows.length) {
      throw conflict("email_taken", "Энэ и-мэйл аль хэдийн бүртгэлтэй байна.");
    }

    const passwordHash = await hashPassword(password);

    const user = await withTransaction(async (client) => {
      const playerCode = await uniquePlayerCode(client);
      const { rows } = await client.query(
        `insert into users (email, password_hash, display_name, player_code)
         values ($1, $2, $3, $4)
         returning id, email, display_name, player_code, coins`,
        [email, passwordHash, name, playerCode]
      );
      return rows[0];
    });

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  })
);

router.post(
  "/login",
  wrap(async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");

    if (!email || !password) {
      throw badRequest("missing_fields", "И-мэйл болон нууц үгээ оруулна уу.");
    }

    const { rows } = await query(
      `select id, email, password_hash, display_name, player_code, coins
         from users where email = $1`,
      [email]
    );

    // Бүртгэл байхгүй ба нууц үг буруу хоёрт ижил хариу — хаяг таамаглахаас сэргийлнэ
    const user = rows[0];
    const ok = user ? await verifyPassword(password, user.password_hash) : false;
    if (!ok) throw unauthorized("bad_credentials", "И-мэйл эсвэл нууц үг буруу байна.");

    await query("update users set last_seen_at = now() where id = $1", [user.id]);

    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

// Одоогийн нэвтэрсэн хэрэглэгч (зоос нь үргэлж DB-ээс шинэ)
router.get(
  "/me",
  requireAuth,
  wrap(async (req, res) => {
    const stats = await query(
      `select plays, wins, win_rate from user_stats where user_id = $1`,
      [req.user.id]
    );

    res.json({
      user: publicUser(req.user),
      stats: stats.rows[0] ?? { plays: 0, wins: 0, win_rate: 0 },
    });
  })
);

// Профайлын "ТОГЛОСОН ТҮҮХ"
router.get(
  "/me/history",
  requireAuth,
  wrap(async (req, res) => {
    const { rows } = await query(
      `select match_id, mode, ended_at, place, final_score,
              tsai, avlaga, uglug, room_name, player_count
         from user_match_history where user_id = $1 limit 30`,
      [req.user.id]
    );
    res.json({ history: rows });
  })
);

router.patch(
  "/me",
  requireAuth,
  wrap(async (req, res) => {
    const name = String(req.body?.name ?? "").trim();
    if (!name) throw badRequest("no_name", "Тоглогчийн нэрээ оруулна уу.");

    const { rows } = await query(
      `update users set display_name = $1 where id = $2
       returning id, email, display_name, player_code, coins`,
      [name, req.user.id]
    );

    res.json({ user: publicUser(rows[0]) });
  })
);

export default router;
