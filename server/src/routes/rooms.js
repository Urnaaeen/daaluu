import { Router } from "express";
import { query, withTransaction } from "../db.js";
import { requireAuth } from "../lib/auth.js";
import { badRequest, conflict, notFound, wrap } from "../lib/errors.js";
import { applyCoins, ROOM_PRICE } from "../services/coins.js";

const router = Router();

router.use(requireAuth);

// Давхцахгүй 4 оронтой код
const uniqueRoomCode = async (client) => {
  for (let attempt = 0; attempt < 30; attempt++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const { rows } = await client.query("select 1 from rooms where code = $1", [code]);
    if (!rows.length) return code;
  }
  throw conflict("code_exhausted", "Өрөөний код үүсгэж чадсангүй.");
};

// Миний өрөөнүүд + гишүүд
router.get(
  "/",
  wrap(async (req, res) => {
    const rooms = await query(
      `select r.id, r.name, r.code, r.created_at,
              coalesce(count(m.user_id) filter (where m.status <> 'removed'), 0)::int as member_count
         from rooms r
         left join room_members m on m.room_id = r.id
        where r.owner_id = $1 and r.is_active
        group by r.id
        order by r.created_at`,
      [req.user.id]
    );

    res.json({ rooms: rooms.rows, price: ROOM_PRICE, coins: req.user.coins });
  })
);

// Өрөө худалдаж авах — зоос хасах ба өрөө үүсгэх НЭГ transaction дотор
router.post(
  "/",
  wrap(async (req, res) => {
    const name = String(req.body?.name ?? "").trim() || "Шинэ өрөө";

    const result = await withTransaction(async (client) => {
      const { balanceAfter, ledgerId } = await applyCoins(client, {
        userId: req.user.id,
        kind: "room_buy",
        amount: -ROOM_PRICE,
        note: "Өрөө худалдаж авав",
      });

      const code = await uniqueRoomCode(client);
      const room = await client.query(
        `insert into rooms (owner_id, name, code, bought_tx)
         values ($1, $2, $3, $4)
         returning id, name, code, created_at`,
        [req.user.id, name, code, ledgerId]
      );

      // Ledger мөрөнд аль өрөө болохыг холбоно
      await client.query("update coin_ledger set room_id = $1 where id = $2", [
        room.rows[0].id,
        ledgerId,
      ]);

      return { room: room.rows[0], coins: balanceAfter };
    });

    res.status(201).json(result);
  })
);

// Өрөөний гишүүд
router.get(
  "/:id/members",
  wrap(async (req, res) => {
    const owned = await query("select 1 from rooms where id = $1 and owner_id = $2", [
      req.params.id,
      req.user.id,
    ]);
    if (!owned.rows.length) throw notFound("room_not_found", "Өрөө олдсонгүй.");

    const members = await query(
      `select u.id, u.display_name as name, u.player_code, m.status, m.invited_at
         from room_members m
         join users u on u.id = m.user_id
        where m.room_id = $1 and m.status <> 'removed'
        order by m.invited_at`,
      [req.params.id]
    );

    res.json({ members: members.rows });
  })
);

// ID-гаар урих
router.post(
  "/:id/invite",
  wrap(async (req, res) => {
    const playerCode = String(req.body?.playerCode ?? "").trim();
    if (!playerCode) throw badRequest("no_code", "Тоглогчийн ID-г оруулна уу.");

    const owned = await query("select id from rooms where id = $1 and owner_id = $2", [
      req.params.id,
      req.user.id,
    ]);
    if (!owned.rows.length) throw notFound("room_not_found", "Өрөө олдсонгүй.");

    const target = await query("select id, display_name from users where player_code = $1", [
      playerCode,
    ]);
    if (!target.rows.length) throw notFound("player_not_found", "Ийм тоглогч олдсонгүй.");
    if (target.rows[0].id === req.user.id) {
      throw badRequest("self_invite", "Өөрийгөө урих боломжгүй.");
    }

    const existing = await query(
      "select status from room_members where room_id = $1 and user_id = $2",
      [req.params.id, target.rows[0].id]
    );
    if (existing.rows.length && existing.rows[0].status !== "removed") {
      throw conflict("already_invited", "Энэ тоглогч аль хэдийн уригдсан.");
    }

    const count = await query(
      "select count(*)::int as n from room_members where room_id = $1 and status <> 'removed'",
      [req.params.id]
    );
    // Хост + 4 = 5 тоглогч
    if (count.rows[0].n >= 4) throw conflict("room_full", "Өрөө дүүрсэн байна.");

    await query(
      `insert into room_members (room_id, user_id, status) values ($1, $2, 'invited')
       on conflict (room_id, user_id) do update set status = 'invited', invited_at = now()`,
      [req.params.id, target.rows[0].id]
    );

    res.status(201).json({ ok: true, name: target.rows[0].display_name });
  })
);

// Гишүүн хасах
router.delete(
  "/:id/members/:userId",
  wrap(async (req, res) => {
    const owned = await query("select 1 from rooms where id = $1 and owner_id = $2", [
      req.params.id,
      req.user.id,
    ]);
    if (!owned.rows.length) throw notFound("room_not_found", "Өрөө олдсонгүй.");

    await query(
      "update room_members set status = 'removed' where room_id = $1 and user_id = $2",
      [req.params.id, req.params.userId]
    );

    res.json({ ok: true });
  })
);

export default router;
