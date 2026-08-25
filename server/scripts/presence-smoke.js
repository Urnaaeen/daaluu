/**
 * Онлайн тоолол (presence) шалгах.
 *   node scripts/presence-smoke.js
 */
import { io as ioClient } from "socket.io-client";
import { config } from "../src/config.js";

const HTTP = `http://localhost:${config.port}`;
const BASE = `${HTTP}/api`;

let passed = 0;
let failed = 0;

const check = (name, ok, detail = "") => {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name} ${detail}`);
  }
};

const call = async (method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json().catch(() => ({}));
};

const newUser = async (name) => {
  const email = `pr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}@test.mn`;
  const r = await call("POST", "/auth/register", { name, email, password: "nuuts123" });
  return r.token;
};

const connect = (token) =>
  new Promise((resolve, reject) => {
    const s = ioClient(HTTP, { auth: { token }, transports: ["websocket"] });
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
    setTimeout(() => reject(new Error("timeout")), 5000);
  });

/** presence мэдээлэл ирэхийг хүлээнэ */
const nextPresence = (socket, ms = 4000) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    socket.once("presence", (p) => {
      clearTimeout(timer);
      resolve(p);
    });
  });

/** Тодорхой утга ирэх хүртэл хүлээнэ (өмнөх цацалтуудыг алгасна) */
const waitOnline = (socket, expected, ms = 6000) =>
  new Promise((resolve) => {
    const onEvent = (p) => {
      if (p?.online === expected) {
        clearTimeout(timer);
        socket.off("presence", onEvent);
        resolve(p);
      }
    };
    const timer = setTimeout(() => {
      socket.off("presence", onEvent);
      resolve(null);
    }, ms);
    socket.on("presence", onEvent);
  });

const httpOnline = async () => (await fetch(`${BASE}/health`).then((r) => r.json())).online;

const run = async () => {
  console.log("\n── Эхлэх төлөв ──");
  const startCount = await httpOnline();
  check("health online талбар буцаана", typeof startCount === "number", String(startCount));

  console.log("\n── Нэг хүн холбогдох ──");
  const a = await newUser("Тэмүүлэн");
  const sa = await connect(a);
  const firstPresence = await nextPresence(sa);
  check("холбогдмогц presence ирлээ", !!firstPresence, JSON.stringify(firstPresence));
  check("тоо 1-ээр нэмэгдэв", firstPresence?.online === startCount + 1,
    `${startCount} → ${firstPresence?.online}`);

  console.log("\n── Хоёр дахь хүн ──");
  const b = await newUser("Хандцоож");
  const waitTwo = waitOnline(sa, startCount + 2);
  const sb = await connect(b);
  const two = await waitTwo;
  check("эхнийх нь шинэчлэл авав", !!two, "мэдээлэл ирсэнгүй");
  check("тоо 2 боллоо", two?.online === startCount + 2, `→ ${two?.online}`);
  check("HTTP-ээр ч ижил", (await httpOnline()) === startCount + 2);

  console.log("\n── Нэг хүн 2 төхөөрөмжөөс ──");
  const sa2 = await connect(a);
  await new Promise((r) => setTimeout(r, 600));
  const afterDual = await httpOnline();
  check("давхар холболт тоог нэмээгүй", afterDual === startCount + 2, `→ ${afterDual}`);

  sa2.close();
  await new Promise((r) => setTimeout(r, 600));
  check("нэг холболт тасрахад офлайн болоогүй", (await httpOnline()) === startCount + 2);

  console.log("\n── Салах ──");
  const waitOne = waitOnline(sa, startCount + 1);
  sb.close();
  const one = await waitOne;
  check("салахад тоо буурав", !!one && one.online === startCount + 1, `→ ${one?.online}`);

  sa.close();
  await new Promise((r) => setTimeout(r, 700));
  check("бүгд салахад эхний тоонд буцав", (await httpOnline()) === startCount,
    `→ ${await httpOnline()}`);

  console.log(`\n${passed} тэнцсэн, ${failed} унасан\n`);
  process.exitCode = failed ? 1 : 0;
};

run().catch((err) => {
  console.error("Script алдаа:", err);
  process.exitCode = 1;
});
