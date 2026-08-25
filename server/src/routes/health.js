import { Router } from "express";
import { query } from "../db.js";
import { getOnlineCount } from "../realtime.js";

const router = Router();

// Сервер амьд эсэх
router.get("/health", (req, res) => {
  res.json({ ok: true, uptime: Math.round(process.uptime()), online: getOnlineCount() });
});

// Postgres холбогдож байгаа эсэх, ямар migration хийгдсэн
router.get("/health/db", async (req, res, next) => {
  try {
    const info = await query(
      "select current_database() as db, current_user as usr, version() as version"
    );

    let migrations = [];
    try {
      const applied = await query(
        "select name, applied_at from schema_migrations order by name"
      );
      migrations = applied.rows;
    } catch {
      // schema_migrations хараахан үүсээгүй байж болно
    }

    res.json({
      ok: true,
      database: info.rows[0].db,
      user: info.rows[0].usr,
      version: info.rows[0].version.split(",")[0],
      migrations,
    });
  } catch (err) {
    next(err);
  }
});

// Модны лавлах — апп болон туршилтад эрэмбэ/өнгө хэрэгтэй
router.get("/health/tiles", async (req, res, next) => {
  try {
    const { rows } = await query(
      "select type_id, title, color, rank, copies, poem from tile_types order by rank desc, type_id"
    );
    res.json({ tiles: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
