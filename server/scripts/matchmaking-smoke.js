/**
 * Дараалал бүрдэж тоглолт эхлэхийг шалгана.
 *   node scripts/matchmaking-smoke.js
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

const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json().catch(() => ({}));
};

const newUser = async (name) => {
  const email = `mm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}@test.mn`;
  const r = await call("POST", "/auth/register", {
    body: { name, email, password: "nuuts123" },
  });
  return { token: r.token, user: r.user, name };
};

const connect = (token) =>
  new Promise((resolve, reject) => {
    const s = ioClient(HTTP, { auth: { token }, transports: ["websocket"] });
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
    setTimeout(() => reject(new Error("timeout")), 5000);
  });

const emit = (socket, event, payload) =>
  new Promise((resolve) => {
    let done = false;
    socket.emit(event, payload, (res) => { done = true; resolve(res); });
    setTimeout(() => !done && resolve(null), 5000);
  });

const once = (socket, event, ms = 15000) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    socket.once(event, (p) => { clearTimeout(timer); resolve(p); });
  });

const run = async () => {
  console.log("\n── 5 хүн бүрдэхэд ──");

  const users = [];
  for (const n of ["Тэмүүлэн", "Хандцоож", "Шижир", "Энхлэн", "Уламбаяр"]) {
    users.push(await newUser(n));
  }
  const sockets = [];
  for (const u of users) sockets.push(await connect(u.token));

  // Бүгд matched-ийг сонсоно
  const matchedPromises = sockets.map((s) => once(s, "queue:matched"));

  // Эхний 4 орно
  for (let i = 0; i < 4; i++) await emit(sockets[i], "queue:join", {});

  // Эхнийх нь дүрмээ сонгоно
  await emit(sockets[0], "queue:setRule", { endRule: "uglug6" });

  const beforeFifth = await emit(sockets[1], "queue:join", {});
  check("4 хүн хүлээж байна", beforeFifth?.state?.size === 4, String(beforeFifth?.state?.size));

  // 5 дахь хүн орно → тоглолт эхлэх ёстой
  await emit(sockets[4], "queue:join", {});

  const matched = await Promise.all(matchedPromises);
  check("5 хүн бүгд matched авав", matched.every((m) => m?.matchId), JSON.stringify(matched.map((m) => !!m)));

  const matchId = matched[0]?.matchId;
  check("бүгд НЭГ тоглолтод орлоо", matched.every((m) => m?.matchId === matchId));

  console.log("\n── Үүссэн тоглолт ──");
  const state = await call("GET", `/matches/${matchId}`, { token: users[0].token });
  check("тоглолт эхэлсэн", state.match?.status === "playing", state.match?.status);
  check("эхнийхийн сонгосон дүрэм хадгалагдав", state.match?.endRule === "uglug6", state.match?.endRule);
  check("5 суудал бүрдсэн", state.players?.length === 5, String(state.players?.length));
  check("бот байхгүй — бүгд хүн", state.players?.every((p) => !p.isBot));
  check("мод тарагдсан", state.myHand?.length === 10, String(state.myHand?.length));

  const names = state.players.map((p) => p.name).sort().join(",");
  check("нэрс таарч байна", names === [...users].map((u) => u.name).sort().join(","), names);

  console.log("\n── Дараалал хоосорсон ──");
  const after = await emit(sockets[0], "queue:join", {});
  check("шинэ дараалал 1-ээс эхэллээ", after?.state?.size === 1, String(after?.state?.size));
  check("дүрэм анхны утга руу буцав", after?.state?.endRule === "single", after?.state?.endRule);
  await emit(sockets[0], "queue:leave", {});

  console.log("\n── Ботоор нөхөх ──");
  const botMatched = [once(sockets[0], "queue:matched"), once(sockets[1], "queue:matched")];
  await emit(sockets[0], "queue:join", {});
  await emit(sockets[1], "queue:join", {});
  const fill = await emit(sockets[0], "queue:fillWithBots", {});
  check("ботоор нөхөх амжилттай", fill?.ok === true, JSON.stringify(fill));

  const bm = await Promise.all(botMatched);
  check("хоёулаа тоглолтод орлоо", bm.every((m) => m?.matchId === fill?.matchId), JSON.stringify(bm.map((m) => m?.matchId)));

  const botState = await call("GET", `/matches/${fill.matchId}`, { token: users[0].token });
  check("5 суудал дүүрсэн", botState.players?.length === 5, String(botState.players?.length));
  check("2 хүн + 3 бот", botState.players?.filter((p) => p.isBot).length === 3,
    String(botState.players?.filter((p) => p.isBot).length));
  check("тоглолт эхэлсэн", botState.match?.status === "playing");

  const notQueued = await emit(sockets[2], "queue:fillWithBots", {});
  check("дараалалд байхгүй хүн нөхөж чадсангүй", notQueued?.error === "not_in_queue", JSON.stringify(notQueued));

  for (const s of sockets) s.close();

  console.log(`\n${passed} тэнцсэн, ${failed} унасан\n`);
  process.exitCode = failed ? 1 : 0;
};

run().catch((err) => {
  console.error("Script алдаа:", err);
  process.exitCode = 1;
});
