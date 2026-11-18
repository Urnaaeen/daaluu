import dotenv from "dotenv";

dotenv.config();

const required = (name) => {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`.env дотор ${name} тохируулаагүй байна`);
  }
  return value;
};

export const config = {
  port: Number(process.env.PORT ?? 4000),

  // Cloud (Neon, Render, Railway…) дээр ганц DATABASE_URL өгдөг — байвал түүнийг ашиглана
  db: process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
      }
    : {
        host: process.env.PGHOST ?? "localhost",
        port: Number(process.env.PGPORT ?? 5432),
        database: required("PGDATABASE"),
        user: required("PGUSER"),
        password: process.env.PGPASSWORD ?? "",
      },

  // Апп-ын вэб build (expo export) — байвал сервер өөрөө үйлчилнэ (нэг URL, CORS хэрэггүй)
  webDist: process.env.WEB_DIST ?? "../board-game/dist",

  corsOrigins: (process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map((s) => s.trim())
    // "*" бол бүх origin-ийг зөвшөөрнө
    .filter((s) => s && s !== "*"),

  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "30d",

  // Хөгжүүлэлтийн "Төлбөр хийсэн (demo)" товч. Production дээр заавал false.
  allowDemoPayments: process.env.ALLOW_DEMO_PAYMENTS === "true",

  // Гаднаас хандах хаяг (https://домэйн) — QPay callback энд ирнэ
  publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`,

  mail: {
    brevoApiKey: process.env.BREVO_API_KEY ?? "",
    // Brevo дээр баталгаажуулсан илгээгчийн хаяг
    from: process.env.MAIL_FROM ?? "",
    fromName: process.env.MAIL_FROM_NAME ?? "Цай хураах",
  },

  // Бүртгүүлэхэд и-мэйлийн код шаардах эсэх. Анхдагчаар и-мэйл илгээгч
  // тохируулсан үед асна; EMAIL_VERIFICATION=true/false-оор албадаж болно.
  emailVerification:
    process.env.EMAIL_VERIFICATION !== undefined && process.env.EMAIL_VERIFICATION !== ""
      ? process.env.EMAIL_VERIFICATION === "true"
      : Boolean(process.env.BREVO_API_KEY),

  // Зөвхөн тест: кодыг API хариунд буцаана. Production дээр ХЭЗЭЭ Ч асаахгүй.
  mailDevEcho: process.env.MAIL_DEV_ECHO === "true" && process.env.NODE_ENV !== "production",

  qpay: {
    // true бол жинхэнэ QPay (sandbox эсвэл production) руу хандана
    enabled: process.env.QPAY_ENABLED === "true",
    // Sandbox: https://merchant-sandbox.qpay.mn · Production: https://merchant.qpay.mn
    baseUrl: (process.env.QPAY_BASE_URL ?? "https://merchant-sandbox.qpay.mn").replace(/\/$/, ""),
    username: process.env.QPAY_USERNAME ?? "",
    password: process.env.QPAY_PASSWORD ?? "",
    invoiceCode: process.env.QPAY_INVOICE_CODE ?? "",
    callbackSecret: process.env.QPAY_CALLBACK_SECRET ?? "",
  },
};
