import { Router } from "express";
import { query, withTransaction } from "../db.js";
import { requireAuth } from "../lib/auth.js";
import { badRequest, conflict, forbidden, notFound, wrap } from "../lib/errors.js";
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

/** Өрөөний идэвхтэй (хүлээж байгаа эсвэл явагдаж байгаа) тоглолт */
const activeMatchOf = async (roomId) => {
  const { rows } = await query(
    `select id, status from matches
      where room_id = $1 and status in ('lobby', 'playing')
      order by created_at desc limit 1`,
    [roomId]
  );
  return rows[0] ?? null;
};

// Намайг урьсан / миний нэгдсэн бусдын өрөөнүүд + идэвхтэй тоглолт
router.get(
  "/joined",
  wrap(async (req, res) => {
    const { rows } = await query(
      `select r.id, r.name, r.code, u.display_name as owner_name, m.status as my_status,
              (select x.id from matches x
                where x.room_id = r.id and x.status = 'lobby'
                order by x.created_at desc limit 1) as lobby_match_id
         from room_members m
         join rooms r on r.id = m.room_id and r.is_active
         join users u on u.id = r.owner_id
        where m.user_id = $1 and m.status <> 'removed'
        order by m.invited_at desc`,
      [req.user.id]
    );
    res.json({ rooms: rows });
  })
);

// 4 оронтой кодоор найзын өрөөнд нэгдэх
router.post(
  "/join",
  wrap(async (req, res) => {
    const code = String(req.body?.code ?? "").trim();
    if (!/^\d{4}$/.test(code)) throw badRequest("bad_code", "4 оронтой код оруулна уу.");

    const found = await query(
      `select r.id, r.name, r.code, r.owner_id, u.display_name as owner_name
         from rooms r join users u on u.id = r.owner_id
        where r.code = $1 and r.is_active`,
      [code]
    );
    if (!found.rows.length) throw notFound("room_not_found", "Ийм кодтой өрөө олдсонгүй.");
    const room = found.rows[0];
    const isOwner = room.owner_id === req.user.id;

    if (!isOwner) {
      await withTransaction(async (client) => {
        // Нэг өрөөнд зэрэг олон хүн нэгдэхэд тоо хэтрэхгүйн тулд өрөөг түгжинэ
        await client.query("select 1 from rooms where id = $1 for update", [room.id]);

        const existing = await client.query(
          "select status from room_members where room_id = $1 and user_id = $2",
          [room.id, req.user.id]
        );
        const status = existing.rows[0]?.status;
        if (status === "removed") {
          throw forbidden("removed", "Өрөөний эзэн таныг энэ өрөөнөөс хассан байна.");
        }
        if (status === "joined") return;

        if (!status) {
          const count = await client.query(
            "select count(*)::int as n from room_members where room_id = $1 and status <> 'removed'",
            [room.id]
          );
          if (count.rows[0].n >= 4) throw conflict("room_full", "Өрөө дүүрсэн байна.");
        }

        await client.query(
          `insert into room_members (room_id, user_id, status, joined_at)
           values ($1, $2, 'joined', now())
           on conflict (room_id, user_id)
           do update set status = 'joined', joined_at = now()`,
          [room.id, req.user.id]
        );
      });
    }

    const active = await activeMatchOf(room.id);
    res.json({
      room: { id: room.id, name: room.name, code: room.code, ownerName: room.owner_name },
      isOwner,
      matchId: active?.status === "lobby" ? active.id : null,
      playing: active?.status === "playing",
    });
  })
);

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
