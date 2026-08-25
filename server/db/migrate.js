import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closePool, pool } from "../src/db.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

const ensureTable = async () => {
  await pool.query(`
    create table if not exists schema_migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    )
  `);
};

const listFiles = async () => {
  try {
    const files = await fs.readdir(dir);
    return files.filter((f) => f.endsWith(".sql")).sort();
  } catch {
    return [];
  }
};

const appliedNames = async () => {
  const res = await pool.query("select name from schema_migrations");
  return new Set(res.rows.map((r) => r.name));
};

const showStatus = async () => {
  const files = await listFiles();
  const done = await appliedNames();

  if (!files.length) {
    console.log("Migration файл алга (db/migrations/ хоосон)");
    return;
  }

  console.log("Migration төлөв:\n");
  for (const f of files) {
    console.log(`  ${done.has(f) ? "✅" : "⬜"}  ${f}`);
  }
  const pending = files.filter((f) => !done.has(f)).length;
  console.log(`\n${files.length - pending}/${files.length} хийгдсэн`);
};

const runPending = async () => {
  const files = await listFiles();
  const done = await appliedNames();
  const pending = files.filter((f) => !done.has(f));

  if (!pending.length) {
    console.log("✅ Бүх migration хийгдсэн байна");
    return;
  }

  for (const file of pending) {
    const sql = await fs.readFile(path.join(dir, file), "utf8");
    const client = await pool.connect();

    // Migration бүрийг нэг transaction дотор — алдаа гарвал бүхэлд нь буцаана
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log(`✅ ${file}`);
    } catch (err) {
      await client.query("rollback").catch(() => {});
      console.error(`❌ ${file}\n   ${err.message}`);
      throw err;
    } finally {
      client.release();
    }
  }

  console.log(`\n${pending.length} migration хийгдлээ`);
};

const main = async () => {
  await ensureTable();
  if (process.argv.includes("--status")) await showStatus();
  else await runPending();
};

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());
