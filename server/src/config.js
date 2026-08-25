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

  db: {
    host: process.env.PGHOST ?? "localhost",
    port: Number(process.env.PGPORT ?? 5432),
    database: required("PGDATABASE"),
    user: required("PGUSER"),
    password: process.env.PGPASSWORD ?? "",
  },

  corsOrigins: (process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "30d",

  // Хөгжүүлэлтийн "Төлбөр хийсэн (demo)" товч. Production дээр заавал false.
  allowDemoPayments: process.env.ALLOW_DEMO_PAYMENTS === "true",

  qpay: {
    // Мерчант эрх авмагц true болгоно
    enabled: process.env.QPAY_ENABLED === "true",
    username: process.env.QPAY_USERNAME ?? "",
    password: process.env.QPAY_PASSWORD ?? "",
    invoiceCode: process.env.QPAY_INVOICE_CODE ?? "",
    callbackSecret: process.env.QPAY_CALLBACK_SECRET ?? "",
  },
};
