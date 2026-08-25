import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { query } from "../db.js";
import { unauthorized } from "./errors.js";

const ROUNDS = 10;

export const hashPassword = (plain) => bcrypt.hash(plain, ROUNDS);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

export const signToken = (user) =>
  jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

/**
 * Authorization: Bearer <token> -г шалгаж req.user-д хэрэглэгчийг тавина.
 * Токен дахь sub-ээс өөр юунд ч итгэхгүй — нэр, зоос бүгдийг DB-ээс уншина.
 */
export const requireAuth = async (req, res, next) => {
  try {
    const header = req.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw unauthorized("no_token", "Нэвтрэх шаардлагатай.");

    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      throw unauthorized("bad_token", "Нэвтрэлт хүчингүй болсон. Дахин нэвтэрнэ үү.");
    }

    const { rows } = await query(
      `select id, email, display_name, player_code, coins, created_at
         from users where id = $1`,
      [payload.sub]
    );
    if (!rows.length) throw unauthorized("user_gone", "Бүртгэл олдсонгүй.");

    req.user = rows[0];
    next();
  } catch (err) {
    next(err);
  }
};
