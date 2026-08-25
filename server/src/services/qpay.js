import { config } from "../config.js";

/**
 * QPay-ийн бодит хариултын бүтэц:
 *   { invoice_id, qr_text, qr_image, urls: [{ name, description, logo, link }] }
 *
 * Мерчант эрх аваагүй тул одоохондоо энэ модуль mock хариу үүсгэнэ.
 * Эрх авмагц `createInvoice`-ийн дотрыг QPay REST дуудлагаар солиход
 * бусад код (DB, API, апп) огт өөрчлөгдөхгүй.
 */

// QPay-ийн жинхэнэ deeplink схемүүд — банкны апп руу үсрэхэд ашиглана
const BANKS = [
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

const buildBankUrls = (qrText) =>
  BANKS.map((b) => ({
    name: b.name,
    scheme: b.scheme,
    link: `${b.scheme}://q?qPay_QRcode=${encodeURIComponent(qrText)}`,
  }));

/**
 * Нэхэмжлэх үүсгэнэ.
 * @returns { invoiceId, qrText, qrImage, bankUrls, expiresAt, mock }
 */
export const createInvoice = async ({ userId, packId, coins, priceMnt }) => {
  if (config.qpay.enabled) {
    // TODO: мерчант эрх авсны дараа энд QPay REST дуудна:
    //   POST /v2/auth/token  → access_token
    //   POST /v2/invoice     → { invoice_id, qr_text, qr_image, urls }
    throw new Error("QPay merchant тохиргоо хийгдээгүй байна");
  }

  // ---- mock ----
  const stamp = Date.now().toString(36).toUpperCase();
  const invoiceId = `MOCK-${packId}-${stamp}`;
  // QPay-ийн QR текст нь урт EMVCo мөр байдаг — уртыг нь дуурайв
  const qrText = `0002010102121531279404168${invoiceId}5204000053034965802MN5910DAALUU MN6011ULAANBAATAR`;

  return {
    invoiceId,
    qrText,
    qrImage: null,
    bankUrls: buildBankUrls(qrText),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    mock: true,
  };
};

/**
 * QPay callback-ийн жинхэнэ эсэхийг шалгана.
 * Одоо: .env дэх нууц түлхүүртэй тааруулна.
 * Дараа: QPay-ийн /v2/payment/check-ээр төлбөрийг дахин баталгаажуулна.
 */
export const verifyCallback = ({ secret }) => {
  if (!config.qpay.callbackSecret) return false;
  return secret === config.qpay.callbackSecret;
};
