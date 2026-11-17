import { config } from "../config.js";

/**
 * QPay Merchant API v2.
 *
 *  - QPAY_ENABLED=false → mock нэхэмжлэх (локал хөгжүүлэлт, demo төлбөр)
 *  - QPAY_ENABLED=true  → жинхэнэ QPay. QPAY_BASE_URL анхдагчаар sandbox;
 *    гэрээ хийсний дараа https://merchant.qpay.mn болгож, мерчант эрхээ тавина.
 *
 * Төлбөрийг ХЭЗЭЭ Ч callback-ийн агуулгаар биш, /v2/payment/check-ээр
 * QPay-ээс дахин асууж баталгаажуулна.
 */

// Mock горимд QPay-ийн жинхэнэ deeplink схемүүдийг дуурайна
const MOCK_BANKS = [
  { name: "Хаан банк", scheme: "khanbank" },
  { name: "Голомт банк", scheme: "golomtbank" },
  { name: "Худалдаа хөгжлийн банк", scheme: "tdbbank" },
  { name: "Төрийн банк", scheme: "statebank" },
  { name: "Хас банк", scheme: "xacbank" },
  { name: "М банк", scheme: "mbank" },
  { name: "Ард апп", scheme: "ardapp" },
  { name: "Most money", scheme: "most" },
  { name: "SocialPay", scheme: "socialpay-payment" },
  { name: "Monpay", scheme: "Monpay" },
  { name: "Toki", scheme: "toki" },
  { name: "Капитрон банк", scheme: "capitronbank" },
  { name: "Богд банк", scheme: "bogdbank" },
  { name: "Тээвэр хөгжлийн банк", scheme: "transbank" },
];

/* ─────────── token ─────────── */

let token = null; // { access, validUntil }

const getToken = async () => {
  if (token && token.validUntil > Date.now()) return token.access;

  const basic = Buffer.from(`${config.qpay.username}:${config.qpay.password}`).toString("base64");
  const res = await fetch(`${config.qpay.baseUrl}/v2/auth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`QPay token ${res.status}`);
  const json = await res.json();

  // expires_in нь заримдаа unix секунд, заримдаа үлдсэн секунд — аль алинд нь
  // аюулгүй байхаар хамгийн ихдээ 20 минут хадгалж, дараа нь шинээр авна
  const raw = Number(json.expires_in) || 0;
  const expiresAt = raw > 1e9 ? raw * 1000 : Date.now() + raw * 1000;
  token = {
    access: json.access_token,
    validUntil: Math.min(expiresAt - 60_000, Date.now() + 20 * 60_000),
  };
  return token.access;
};

const qpayPost = async (path, body, retry = true) => {
  const res = await fetch(`${config.qpay.baseUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await getToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });

  // Token хугацаа нь дууссан бол нэг удаа шинээр аваад давтана
  if (res.status === 401 && retry) {
    token = null;
    return qpayPost(path, body, false);
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`QPay ${path} ${res.status}: ${json.message ?? json.error ?? ""}`);
  }
  return json;
};

/* ─────────── нэхэмжлэх ─────────── */

const callbackUrl = (paymentId) => {
  const base = config.publicUrl.replace(/\/$/, "");
  const secret = encodeURIComponent(config.qpay.callbackSecret);
  return `${base}/api/coins/callback?payment_id=${paymentId}&secret=${secret}`;
};

/**
 * Нэхэмжлэх үүсгэнэ.
 * @param paymentId манай payments.id — QPay талд sender_invoice_no болно
 * @returns { invoiceId, qrText, qrImage, bankUrls, expiresAt, mock }
 */
export const createInvoice = async ({ paymentId, coins, priceMnt }) => {
  if (config.qpay.enabled) {
    const inv = await qpayPost("/v2/invoice", {
      invoice_code: config.qpay.invoiceCode,
      sender_invoice_no: String(paymentId),
      invoice_receiver_code: "terminal",
      invoice_description: `Цай хураах · ${coins} зоос`,
      amount: priceMnt,
      callback_url: callbackUrl(paymentId),
    });

    return {
      invoiceId: inv.invoice_id,
      qrText: inv.qr_text,
      qrImage: inv.qr_image ?? null,
      bankUrls: (inv.urls ?? []).map((u) => ({
        name: u.description || u.name,
        scheme: u.name,
        logo: u.logo,
        link: u.link,
      })),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      mock: false,
    };
  }

  // ---- mock ----
  const invoiceId = `MOCK-${paymentId}-${Date.now().toString(36).toUpperCase()}`;
  const qrText = `0002010102121531279404168${invoiceId}5204000053034965802MN5910DAALUU MN6011ULAANBAATAR`;

  return {
    invoiceId,
    qrText,
    qrImage: null,
    bankUrls: MOCK_BANKS.map((b) => ({
      name: b.name,
      scheme: b.scheme,
      link: `${b.scheme}://q?qPay_QRcode=${encodeURIComponent(qrText)}`,
    })),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    mock: true,
  };
};

/**
 * Нэхэмжлэхийн төлбөрийг QPay-ээс шалгана.
 * @returns { paidAmount, raw } — paidAmount нь PAID төлөвтэй гүйлгээний нийлбэр
 */
export const checkInvoicePaid = async (invoiceId) => {
  const json = await qpayPost("/v2/payment/check", {
    object_type: "INVOICE",
    object_id: invoiceId,
    offset: { page_number: 1, page_limit: 100 },
  });

  const paidAmount = (json.rows ?? [])
    .filter((r) => String(r.payment_status).toUpperCase() === "PAID")
    .reduce((sum, r) => sum + Number(r.payment_amount ?? 0), 0);

  return { paidAmount, raw: json };
};

/** Callback URL-д бидний тавьсан нууц түлхүүр таарч байгаа эсэх */
export const verifyCallback = ({ secret }) => {
  if (!config.qpay.callbackSecret) return false;
  return secret === config.qpay.callbackSecret;
};

export const qpayEnabled = () => config.qpay.enabled;
