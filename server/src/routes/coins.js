import { Router } from "express";
import { config } from "../config.js";
import { query, withTransaction } from "../db.js";
import { requireAuth } from "../lib/auth.js";
import { badRequest, forbidden, notFound, wrap } from "../lib/errors.js";
import { applyCoins, COIN_PACKS, findPack } from "../services/coins.js";
import { createInvoice, verifyCallback } from "../services/qpay.js";

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

// Цэнэглэх нэхэмжлэх үүсгэх → апп QR + банкны товчнуудыг харуулна
router.post(
  "/invoice",
  requireAuth,
  wrap(async (req, res) => {
    const pack = findPack(String(req.body?.packId ?? ""));
    if (!pack) throw badRequest("bad_pack", "Ийм багц байхгүй байна.");

    const invoice = await createInvoice({
      userId: req.user.id,
      packId: pack.id,
      coins: pack.coins,
      priceMnt: pack.price,
    });

    const { rows } = await query(
      `insert into payments
         (user_id, pack_coins, price_mnt, qpay_invoice_id, qr_text, qr_image, bank_urls, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, pack_coins, price_mnt, qpay_invoice_id, qr_text, qr_image, bank_urls, status, expires_at`,
      [
        req.user.id,
        pack.coins,
        pack.price,
        invoice.invoiceId,
        invoice.qrText,
        invoice.qrImage,
        JSON.stringify(invoice.bankUrls),
        invoice.expiresAt,
      ]
    );

    res.status(201).json({ payment: rows[0], mock: !!invoice.mock });
  })
);

// Нэхэмжлэхийн төлөв — апп QR харуулж байхдаа асууна
router.get(
  "/invoice/:id",
  requireAuth,
  wrap(async (req, res) => {
    const { rows } = await query(
      `select id, pack_coins, price_mnt, qr_text, bank_urls, status, paid_at, expires_at
         from payments where id = $1 and user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) throw notFound("payment_not_found", "Нэхэмжлэх олдсонгүй.");
    res.json({ payment: rows[0], coins: req.user.coins });
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

// QPay-ийн webhook. Нууц түлхүүрээр баталгаажна — нэвтрэлт шаардахгүй.
router.post(
  "/callback",
  wrap(async (req, res) => {
    const secret = req.query.secret ?? req.get("x-qpay-secret");
    if (!verifyCallback({ secret })) {
      throw forbidden("bad_callback_secret", "Callback баталгаажсангүй.");
    }

    const paymentId = req.body?.payment_id ?? req.query.payment_id;
    if (!paymentId) throw badRequest("no_payment_id", "payment_id алга.");

    const result = await settlePayment(paymentId, req.body);
    res.json({ ok: true, ...result });
  })
);

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
