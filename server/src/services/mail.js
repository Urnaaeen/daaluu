import { config } from "../config.js";

/**
 * И-мэйл илгээх.
 *  - BREVO_API_KEY байвал Brevo-ийн HTTP API-аар илгээнэ (Render-ийн үнэгүй
 *    сервер SMTP портуудыг хаадаг тул SMTP биш HTTP ашиглана).
 *  - Байхгүй бол зөвхөн консолд хэвлэнэ (локал хөгжүүлэлт).
 */
export const sendMail = async ({ to, subject, text, html }) => {
  if (!config.mail.brevoApiKey) {
    console.log(`[mail:log] → ${to} · ${subject}\n${text}`);
    return;
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": config.mail.brevoApiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: config.mail.from, name: config.mail.fromName },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo ${res.status}: ${body.slice(0, 200)}`);
  }
};

export const sendVerificationCode = (to, code) =>
  sendMail({
    to,
    subject: `Цай хураах — баталгаажуулах код: ${code}`,
    text: `Таны бүртгэлийн баталгаажуулах код: ${code}\n\nКод 10 минутын дотор хүчинтэй.\nХэрэв та бүртгүүлээгүй бол энэ захидлыг үл тоомсорлоно уу.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;color:#222">
  <h2 style="margin:0 0 8px">Цай хураах</h2>
  <p>Таны бүртгэлийн баталгаажуулах код:</p>
  <p style="font-size:34px;font-weight:bold;letter-spacing:8px;background:#fff4e6;border-radius:12px;padding:14px;text-align:center;margin:16px 0">${code}</p>
  <p style="color:#666;font-size:13px">Код 10 минутын дотор хүчинтэй. Хэрэв та бүртгүүлээгүй бол энэ захидлыг үл тоомсорлоно уу.</p>
</div>`,
  });
