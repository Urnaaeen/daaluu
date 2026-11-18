import crypto from "node:crypto";
import { Router } from "express";
import { config } from "../config.js";
import { query, withTransaction } from "../db.js";
import { hashPassword, requireAuth, signToken, verifyPassword } from "../lib/auth.js";
import { ApiError, badRequest, conflict, unauthorized, wrap } from "../lib/errors.js";
import { sendVerificationCode } from "../services/mail.js";

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

/* ─────────── и-мэйл баталгаажуулалт ─────────── */

const CODE_TTL_MIN = 10;
const RESEND_COOLDOWN_S = 60;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

const codeHash = (email, code) =>
  crypto.createHmac("sha256", config.jwtSecret).update(`${email}:${code}`).digest("hex");

const sameHash = (a, b) =>
  a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// IP тус бүрээс цагт илгээх кодын хязгаар (санах ойд — нэг сервер)
const ipSends = new Map();
const ipAllowed = (ip) => {
  const now = Date.now();
  const hits = (ipSends.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (hits.length >= 20) return false;
  hits.push(now);
  ipSends.set(ip, hits);
  return true;
};

const tooMany = (message) => new ApiError(429, "too_many_requests", message);

const validateSignup = ({ name, email, password }) => {
  if (!name) throw badRequest("no_name", "Тоглогчийн нэрээ оруулна уу.");
  if (!EMAIL_RE.test(email)) throw badRequest("bad_email", "И-мэйл хаяг буруу байна.");
  if (password.length < 6) throw badRequest("weak_password", "Нууц үг дор хаяж 6 тэмдэгт байх ёстой.");
};

const readSignup = (body) => ({
  name: String(body?.name ?? "").trim(),
  email: String(body?.email ?? "").trim().toLowerCase(),
  password: String(body?.password ?? ""),
});

const assertEmailFree = async (email) => {
  const exists = await query("select 1 from users where email = $1", [email]);
  if (exists.rows.length) {
    throw conflict("email_taken", "Энэ и-мэйл аль хэдийн бүртгэлтэй байна.");
  }
};

// 1-р алхам: и-мэйл рүү 6 оронтой код илгээнэ
router.post(
  "/register/code",
  wrap(async (req, res) => {
    const signup = readSignup(req.body);
    validateSignup(signup);
    const { email } = signup;

    if (!config.emailVerification) {
      return res.json({ required: false });
    }

    await assertEmailFree(email);

    const prev = (await query("select * from email_codes where email = $1", [email])).rows[0];
    const now = Date.now();
    if (prev) {
      const wait = RESEND_COOLDOWN_S - Math.floor((now - prev.sent_at.getTime()) / 1000);
      if (wait > 0) throw tooMany(`Дахин код авахын тулд ${wait} секунд хүлээнэ үү.`);
    }
    const sameWindow = prev && now - prev.window_start.getTime() < 3600_000;
    if (sameWindow && prev.send_count >= MAX_SENDS_PER_HOUR) {
      throw tooMany("Хэт олон код хүссэн байна. 1 цагийн дараа дахин оролдоно уу.");
    }
    if (!ipAllowed(req.ip)) throw tooMany("Хэт олон хүсэлт. Түр хүлээгээд дахин оролдоно уу.");

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

    await query(
      `insert into email_codes (email, code_hash, expires_at, attempts, sent_at, window_start, send_count)
       values ($1, $2, now() + make_interval(mins => $3), 0, now(), now(), 1)
       on conflict (email) do update set
         code_hash = excluded.code_hash,
         expires_at = excluded.expires_at,
         attempts = 0,
         sent_at = now(),
         window_start = case when $4 then email_codes.window_start else now() end,
         send_count = case when $4 then email_codes.send_count + 1 else 1 end`,
      [email, codeHash(email, code), CODE_TTL_MIN, Boolean(sameWindow)]
    );

    try {
      await sendVerificationCode(email, code);
    } catch (e) {
      console.error("verification mail failed:", e.message);
      // Илгээгдээгүй кодоор дахин оролдох хүлээлт үүсгэхгүй
      await query("delete from email_codes where email = $1", [email]);
      throw new ApiError(502, "mail_failed", "Код илгээж чадсангүй. Түр хүлээгээд дахин оролдоно уу.");
    }

    res.json({
      required: true,
      sent: true,
      expiresInMin: CODE_TTL_MIN,
      resendIn: RESEND_COOLDOWN_S,
      ...(config.mailDevEcho ? { devCode: code } : {}),
    });
  })
);

// Кодыг шалгана (transaction-ээс ГАДНА — буруу оролдлогын тоо rollback-д алга болохгүй).
// Зөв бол hash-ийг буцаана; устгах нь бүртгэлийн transaction дотор.
const checkCode = async (email, code) => {
  if (!/^\d{6}$/.test(code)) throw badRequest("bad_code", "6 оронтой кодоо оруулна уу.");

  const { rows } = await query("select * from email_codes where email = $1", [email]);
  const row = rows[0];
  if (!row) throw badRequest("code_missing", "Эхлээд и-мэйл рүүгээ код авна уу.");
  if (row.expires_at.getTime() < Date.now()) {
    throw badRequest("code_expired", "Кодын хугацаа дууссан. Шинэ код авна уу.");
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    throw badRequest("code_locked", "Хэт олон буруу оролдлого. Шинэ код авна уу.");
  }
  if (!sameHash(row.code_hash, codeHash(email, code))) {
    await query("update email_codes set attempts = attempts + 1 where email = $1", [email]);
    const left = MAX_ATTEMPTS - row.attempts - 1;
    throw badRequest(
      "wrong_code",
      left > 0 ? `Код буруу байна. ${left} оролдлого үлдлээ.` : "Код буруу. Шинэ код авна уу."
    );
  }
  return row.code_hash;
};

// 2-р алхам (эсвэл баталгаажуулалт унтраалттай үед шууд): бүртгэл үүсгэнэ
router.post(
  "/register",
  wrap(async (req, res) => {
    const signup = readSignup(req.body);
    validateSignup(signup);
    const { name, email, password } = signup;
    const code = String(req.body?.code ?? "").trim();

    await assertEmailFree(email);

    const verifiedHash = config.emailVerification ? await checkCode(email, code) : null;
    const passwordHash = await hashPassword(password);

    const user = await withTransaction(async (client) => {
      // Нэг кодоор зэрэг хоёр бүртгэл үүсгэхээс сэргийлж яг тэр hash-тай row-ийг устгана
      if (verifiedHash) {
        const del = await client.query(
          "delete from email_codes where email = $1 and code_hash = $2",
          [email, verifiedHash]
        );
        if (!del.rowCount) throw badRequest("code_missing", "Код аль хэдийн ашиглагдсан. Шинэ код авна уу.");
      }

      const playerCode = await uniquePlayerCode(client);
      const { rows } = await client.query(
        `insert into users (email, password_hash, display_name, player_code, email_verified_at)
         values ($1, $2, $3, $4, $5)
         returning id, email, display_name, player_code, coins`,
        [email, passwordHash, name, playerCode, config.emailVerification ? new Date() : null]
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
