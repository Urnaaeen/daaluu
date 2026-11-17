import { Router } from "express";
import { config } from "../config.js";
import { query, withTransaction } from "../db.js";
import { requireAuth } from "../lib/auth.js";
import { ApiError, badRequest, forbidden, notFound, wrap } from "../lib/errors.js";
import { applyCoins, COIN_PACKS, findPack } from "../services/coins.js";
import { checkInvoicePaid, createInvoice, qpayEnabled, verifyCallback } from "../services/qpay.js";

const router = Router();

// Багцын жагсаалт — үнэ серверээс ирнэ
router.get("/packs", (req, res) => {
  res.json({ packs: COIN_PACKS });
});

// Үлдэгдэл ба зоосны хөдөлгөөн
router.get(
  "/balance",
  requireAuth,
  wrap(async (req, res) => {
    const ledger = await query(
      `select id, kind, amount, balance_after, note, created_at
         from coin_ledger where user_id = $1
        order by created_at desc limit 50`,
      [req.user.id]
    );
    res.json({ coins: req.user.coins, ledger: ledger.rows });
  })
);

const PAYMENT_COLS =
  "id, pack_coins, price_mnt, qpay_invoice_id, qr_text, qr_image, bank_urls, status, paid_at, expires_at";

// Апп "Төлбөр хийсэн (demo)" товч харуулах эсэх
const demoAllowed = () => config.allowDemoPayments;

// Цэнэглэх нэхэмжлэх үүсгэх → апп QR + банкны товчнуудыг харуулна
router.post(
  "/invoice",
  requireAuth,
  wrap(async (req, res) => {
    const pack = findPack(String(req.body?.packId ?? ""));
    if (!pack) throw badRequest("bad_pack", "Ийм багц байхгүй байна.");

    // Эхлээд мөр үүсгэнэ — id нь QPay-д sender_invoice_no болж, callback-д буцаж ирнэ
    const created = await query(
      `insert into payments (user_id, pack_coins, price_mnt) values ($1, $2, $3) returning id`,
      [req.user.id, pack.coins, pack.price]
    );
    const paymentId = created.rows[0].id;

    let invoice;
    try {
      invoice = await createInvoice({ paymentId, coins: pack.coins, priceMnt: pack.price });
    } catch (err) {
      console.error("❌ QPay нэхэмжлэх:", err.message);
      await query("update payments set status = 'failed' where id = $1", [paymentId]);
      throw new ApiError(502, "qpay_unavailable", "QPay-тэй холбогдож чадсангүй. Дахин оролдоно уу.");
    }

    const { rows } = await query(
      `update payments
          set qpay_invoice_id = $2, qr_text = $3, qr_image = $4, bank_urls = $5, expires_at = $6
        where id = $1
        returning ${PAYMENT_COLS}`,
      [
        paymentId,
        invoice.invoiceId,
        invoice.qrText,
        invoice.qrImage,
        JSON.stringify(invoice.bankUrls),
        invoice.expiresAt,
      ]
    );

    res.status(201).json({ payment: rows[0], mock: !!invoice.mock, demo: demoAllowed() });
  })
);

/**
 * QPay-ээс төлбөрийг шалгаж, төлөгдсөн бол зоос нэмнэ.
 * Апп 3 секунд тутам асуудаг тул нэг нэхэмжлэхийг 3с-д нэгээс олон удаа QPay руу явуулахгүй.
 */
const lastCheck = new Map();

const syncWithQpay = async (payment) => {
  if (!qpayEnabled() || payment.status !== "pending" || !payment.qpay_invoice_id) return null;
  if (payment.qpay_invoice_id.startsWith("MOCK-")) return null;

  const now = Date.now();
  if (now - (lastCheck.get(payment.id) ?? 0) < 3000) return null;
  lastCheck.set(payment.id, now);

  const { paidAmount, raw } = await checkInvoicePaid(payment.qpay_invoice_id);
  if (paidAmount < payment.price_mnt) return null;

  lastCheck.delete(payment.id);
  return settlePayment(payment.id, raw);
};

// Нэхэмжлэхийн төлөв — апп QR харуулж байхдаа асууна
router.get(
  "/invoice/:id",
  requireAuth,
  wrap(async (req, res) => {
    const load = () =>
      query(`select ${PAYMENT_COLS} from payments where id = $1 and user_id = $2`, [
        req.params.id,
        req.user.id,
      ]);

    let { rows } = await load();
    if (!rows.length) throw notFound("payment_not_found", "Нэхэмжлэх олдсонгүй.");

    let coins = req.user.coins;
    try {
      const settled = await syncWithQpay(rows[0]);
      if (settled) {
        coins = settled.coins;
        ({ rows } = await load());
      }
    } catch (err) {
      // QPay түр хүрэхгүй байсан ч төлөвийг буцаана — дараагийн асуултаар дахин шалгана
      console.error("⚠️ QPay шалгалт:", err.message);
    }

    res.json({ payment: rows[0], coins, demo: demoAllowed() });
  })
);

/**
 * Төлбөрийг баталгаажуулж зоос нэмэх ЦОРЫН ГАНЦ дотоод функц.
 * `for update` + status шалгалт нь нэг нэхэмжлэхийг хоёр удаа тооцохоос сэргийлнэ.
 */
const settlePayment = async (paymentId, rawCallback) =>
  withTransaction(async (client) => {
    const { rows } = await client.query(
      `select id, user_id, pack_coins, status from payments where id = $1 for update`,
      [paymentId]
    );
    if (!rows.length) throw notFound("payment_not_found", "Нэхэмжлэх олдсонгүй.");

    const payment = rows[0];
    if (payment.status === "paid") {
      // Давхар callback — дахин зоос нэмэхгүй
      const user = await client.query("select coins from users where id = $1", [payment.user_id]);
      return { alreadyPaid: true, coins: user.rows[0].coins };
    }
    if (payment.status !== "pending") {
      throw badRequest("payment_not_pending", "Энэ нэхэмжлэх идэвхгүй байна.");
    }

    await client.query(
      `update payments set status = 'paid', paid_at = now(), callback_raw = $2 where id = $1`,
      [payment.id, rawCallback ? JSON.stringify(rawCallback) : null]
    );

    const { balanceAfter } = await applyCoins(client, {
      userId: payment.user_id,
      kind: "purchase",
      amount: payment.pack_coins,
      paymentId: payment.id,
      note: "QPay цэнэглэлт",
    });

    return { alreadyPaid: false, coins: balanceAfter };
  });

/**
 * QPay-ийн webhook. URL дахь нууц түлхүүрээр шүүж, төлбөрийг QPay-ээс
 * ДАХИН асууж баталгаажуулна — callback-ийн агуулгад итгэхгүй.
 * QPay ихэвчлэн GET-ээр дууддаг тул хоёуланг нь хүлээн авна.
 */
const handleCallback = wrap(async (req, res) => {
  const secret = req.query.secret ?? req.get("x-qpay-secret");
  if (!verifyCallback({ secret })) {
    throw forbidden("bad_callback_secret", "Callback баталгаажсангүй.");
  }

  const paymentId = req.query.payment_id ?? req.body?.payment_id;
  if (!paymentId) throw badRequest("no_payment_id", "payment_id алга.");

  if (!qpayEnabled()) {
    // Mock горим — нууц түлхүүр л хангалттай (локал туршилт)
    const result = await settlePayment(paymentId, req.body ?? null);
    return res.json({ ok: true, ...result });
  }

  const { rows } = await query(
    `select id, price_mnt, qpay_invoice_id, status from payments where id = $1`,
    [paymentId]
  );
  if (!rows.length) throw notFound("payment_not_found", "Нэхэмжлэх олдсонгүй.");

  lastCheck.delete(rows[0].id);
  const result = await syncWithQpay(rows[0]);
  res.json({ ok: true, settled: !!result, ...(result ?? {}) });
});

router.get("/callback", handleCallback);
router.post("/callback", handleCallback);

/**
 * Хөгжүүлэлтийн товч — "Төлбөр хийсэн (demo)".
 * ALLOW_DEMO_PAYMENTS=true үед л ажиллана, production дээр хаалттай.
 */
router.post(
  "/invoice/:id/demo-pay",
  requireAuth,
  wrap(async (req, res) => {
    if (!config.allowDemoPayments) {
      throw forbidden("demo_disabled", "Demo төлбөр идэвхгүй байна.");
    }

    const owned = await query("select 1 from payments where id = $1 and user_id = $2", [
      req.params.id,
      req.user.id,
    ]);
    if (!owned.rows.length) throw notFound("payment_not_found", "Нэхэмжлэх олдсонгүй.");

    const result = await settlePayment(req.params.id, { demo: true });
    res.json({ ok: true, ...result });
  })
);

export default router;
