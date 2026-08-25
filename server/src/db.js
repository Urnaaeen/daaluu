import pg from "pg";
import { config } from "./config.js";

// Нэг pool-ыг бүх модуль хуваан ашиглана
export const pool = new pg.Pool({
  ...config.db,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("❌ Postgres pool алдаа:", err.message);
});

export const query = (text, params) => pool.query(text, params);

/**
 * Хэд хэдэн бичилтийг нэг transaction дотор гүйцэтгэнэ.
 * Зоос нэмэх/хасах, өрөө худалдаж авах зэрэгт заавал ашиглана —
 * дундуур тасарвал юу ч хадгалагдахгүй.
 */
export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

export const closePool = () => pool.end();
