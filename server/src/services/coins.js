import { badRequest, notFound } from "../lib/errors.js";

// Зоосны багцууд — үнэ серверт тогтоно, клиентээс ирсэн үнэд итгэхгүй
export const COIN_PACKS = [
  { id: "p50", coins: 50, price: 1000, bonus: null, rooms: 1 },
  { id: "p120", coins: 120, price: 2000, bonus: "+20 бонус", rooms: 2 },
  { id: "p300", coins: 300, price: 4500, bonus: "+50 бонус", rooms: 6 },
  { id: "p700", coins: 700, price: 9900, bonus: "+150 бонус", rooms: 14 },
];

export const findPack = (id) => COIN_PACKS.find((p) => p.id === id) ?? null;

export const ROOM_PRICE = 50;

/**
 * Зоос нэмэх/хасах ЦОРЫН ГАНЦ зам.
 * Заавал transaction дотор дуудна (withTransaction-ий client дамжуулна).
 *
 * `for update` нь мөрийг түгжинэ — нэг хэрэглэгч зэрэг хоёр хүсэлт
 * илгээж давхар зарцуулах боломжгүй болно.
 */
export const applyCoins = async (
  client,
  { userId, kind, amount, paymentId = null, roomId = null, note = null }
) => {
  if (!Number.isInteger(amount) || amount === 0) {
    throw badRequest("bad_amount", "Зоосны дүн буруу байна.");
  }

  const locked = await client.query("select coins from users where id = $1 for update", [userId]);
  if (!locked.rows.length) throw notFound("user_not_found", "Бүртгэл олдсонгүй.");

  const balanceAfter = locked.rows[0].coins + amount;
  if (balanceAfter < 0) {
    throw badRequest("insufficient_coins", "Зоос хүрэлцэхгүй байна.");
  }

  await client.query("update users set coins = $1 where id = $2", [balanceAfter, userId]);

  const ledger = await client.query(
    `insert into coin_ledger (user_id, kind, amount, balance_after, payment_id, room_id, note)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id, created_at`,
    [userId, kind, amount, balanceAfter, paymentId, roomId, note]
  );

  return { balanceAfter, ledgerId: ledger.rows[0].id, at: ledger.rows[0].created_at };
};
