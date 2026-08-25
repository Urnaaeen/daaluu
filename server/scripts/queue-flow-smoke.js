/**
 * Дарааллын бүтэн урсгалыг шалгана (алхам 5-6):
 *   1. Дарааллд орох → queue:update бүгдэд тархах
 *   2. Эхэлж орсон хүн (owner) дүрмээ солино
 *   3. Бусад тоглогч дүрэм солих гэвэл not_owner
 *   4. Дарааллаас гарахад owner дараагийн хүн рүү шилжинэ
 *   5. 5 хүн бүрдэхэд тоглолт автоматаар эхэлж, queue:matched ирнэ
 *   6. Ботоор нөхөхөд дутуу суудлыг бот эзэлнэ
 */
import { io } from "socket.io-client";

const API = process.env.API_URL ?? "http://localhost:4000";
const stamp = Date.now().toString(36);

let pass = 0;
let fail = 0;

const check = (name, ok, extra = "") => {
  if (ok) {
    pass += 1;
    console.log(`  ✅ ${name}`);
  } else {
    fail += 1;
    console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ""}`);
  }
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const register = async (label) => {
  const res = await fetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: label,
      email: `qf_${label}_${stamp}@test.mn`.toLowerCase(),
      password: "nuuts123",
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`register ${label}: ${JSON.stringify(body)}`);
  return body;
};

/** Сокет клиент — сүүлийн queue төлөв, matched ID-г санана */
const connect = (session) =>
  new Promise((resolve, reject) => {
    const socket = io(API, { auth: { token: session.token }, transports: ["websocket"] });
    const client = {
      socket,
      user: session.user,
      name: session.user.name,
      last: null,
      updates: 0,
      matchId: null,
      errors: [],
    };

    socket.on("queue:update", (state) => {
      client.last = state;
      client.updates += 1;
    });
    socket.on("queue:matched", ({ matchId }) => (client.matchId = matchId));
    socket.on("queue:error", (e) => client.errors.push(e?.message ?? "?"));

    socket.on("connect", () => resolve(client));
    socket.on("connect_error", reject);
    setTimeout(() => reject(new Error(`connect timeout: ${client.name}`)), 8000);
  });

const emit = (client, event, payload) =>
  new Promise((resolve) => {
    let done = false;
    client.socket.emit(event, payload ?? {}, (res) => {
      done = true;
      resolve(res);
    });
    setTimeout(() => !done && resolve(null), 6000);
  });

const matchState = async (session, matchId) => {
  const res = await fetch(`${API}/api/matches/${matchId}`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  return res.json();
};

const run = async () => {
  console.log("\n🎲 Дарааллын урсгалын шалгалт\n");

  /* ── 1. Дарааллд орох, owner тодорхойлогдох ── */
  console.log("1) Дарааллд орох");
  const s1 = await register("Аав");
  const s2 = await register("Ээж");
  const c1 = await connect(s1);
  const c2 = await connect(s2);

  const j1 = await emit(c1, "queue:join");
  check("Эхний тоглогч оров", j1?.ok === true, JSON.stringify(j1));
  check("Тэр өөрөө owner боллоо", j1?.state?.ownerId === s1.user.id);
  check("Дарааллын хэмжээ 1", j1?.state?.size === 1, `size=${j1?.state?.size}`);
  check("Шаардлагатай тоо 5", j1?.state?.needed === 5, `needed=${j1?.state?.needed}`);

  await emit(c2, "queue:join");
  await wait(200);
  check("Хоёр дахь тоглогч нэмэгдэв", c2.last?.size === 2, `size=${c2.last?.size}`);
  check("Эхнийхэд нь update тархав", c1.last?.size === 2, `size=${c1.last?.size}`);
  check("Owner хэвээр эхний хүн", c2.last?.ownerId === s1.user.id);
  check(
    "Нэр, код зөв дамжив",
    c2.last?.players?.[0]?.name === "Аав" && !!c2.last?.players?.[0]?.playerCode,
    JSON.stringify(c2.last?.players?.[0])
  );

  /* ── 2. Дүрмийн эрх ── */
  console.log("\n2) Төгсгөлийн дүрмийн эрх");
  const notOwner = await emit(c2, "queue:setRule", { endRule: "tsai10" });
  check("Owner биш хүн дүрэм солиж чадахгүй", notOwner?.error === "not_owner", JSON.stringify(notOwner));

  const owned = await emit(c1, "queue:setRule", { endRule: "tsai10" });
  check("Owner дүрмээ солив", owned?.ok === true, JSON.stringify(owned));
  await wait(200);
  check("Бусдад шинэ дүрэм тархав", c2.last?.endRule === "tsai10", `endRule=${c2.last?.endRule}`);

  const bogus = await emit(c1, "queue:setRule", { endRule: "yavlaa" });
  check("Байхгүй дүрмийг татгалзав", bogus?.ok !== true, JSON.stringify(bogus));

  /* ── 3. Owner гарахад дараагийнх руу шилжих ── */
  console.log("\n3) Owner дарааллаас гарах");
  await emit(c1, "queue:leave");
  await wait(200);
  check("Хэмжээ 1 болов", c2.last?.size === 1, `size=${c2.last?.size}`);
  check("Owner дараагийн хүн боллоо", c2.last?.ownerId === s2.user.id, `owner=${c2.last?.ownerId}`);
  // Сонгосон дүрэм дараалалд үлдэнэ — шинэ owner өвлөж авна
  check("Сонгосон дүрэм үлдэв", c2.last?.endRule === "tsai10", `endRule=${c2.last?.endRule}`);
  const newOwnerRule = await emit(c2, "queue:setRule", { endRule: "single" });
  check("Шинэ owner дүрмээ солив", newOwnerRule?.ok === true, JSON.stringify(newOwnerRule));

  /* ── 4. Ботоор нөхөх ── */
  console.log("\n4) Ботоор нөхөх");
  const filled = await emit(c2, "queue:fillWithBots");
  check("Тоглолт үүсэв", !!filled?.matchId, JSON.stringify(filled));
  await wait(400);
  check("queue:matched хүрч ирэв", c2.matchId === filled?.matchId, `matched=${c2.matchId}`);

  const st = await matchState(s2, filled.matchId);
  check("5 суудал дүүрэв", st?.players?.length === 5, `players=${st?.players?.length}`);
  check("Бот 4 ширхэг", st?.players?.filter((p) => p.isBot).length === 4);
  check("Хүн ганцаараа", st?.players?.filter((p) => !p.isBot).length === 1);
  check("Дүрэм шилжив", st?.match?.endRule === "single", `endRule=${st?.match?.endRule}`);
  check("Тоглолт эхэлсэн", st?.match?.status === "playing", `status=${st?.match?.status}`);
  check("Дараалал хоосорсон", c2.last?.size === 0, `size=${c2.last?.size}`);

  /* ── 5. 5 хүн бүрдэхэд автоматаар эхлэх ── */
  console.log("\n5) 5 хүн бүрдэхэд автоматаар эхлэх");
  const sessions = [];
  const clients = [];
  for (const label of ["Нэг", "Хоёр", "Гурав", "Дөрөв", "Тав"]) {
    const s = await register(label);
    sessions.push(s);
    clients.push(await connect(s));
  }

  for (const c of clients) {
    await emit(c, "queue:join");
    await wait(120);
  }
  await wait(600);

  const ids = clients.map((c) => c.matchId);
  check("Бүгд queue:matched авав", ids.every(Boolean), JSON.stringify(ids));
  check("Бүгд ижил тоглолтод", new Set(ids).size === 1, JSON.stringify(ids));

  if (ids[0]) {
    const st2 = await matchState(sessions[0], ids[0]);
    check("5 хүн суув", st2?.players?.length === 5, `players=${st2?.players?.length}`);
    check("Бот байхгүй", st2?.players?.every((p) => !p.isBot) === true);
    check("Тоглолт эхэлсэн", st2?.match?.status === "playing", `status=${st2?.match?.status}`);
    check(
      "Эхний тоглогч host",
      st2?.players?.find((p) => p.isHost)?.name === "Нэг",
      st2?.players?.find((p) => p.isHost)?.name
    );
  }

  check("Дараалал дахин хоосон", clients[4].last?.size === 0, `size=${clients[4].last?.size}`);

  /* ── 6. Салгахад дарааллаас хасагдах ── */
  console.log("\n6) Холболт тасрахад дарааллаас хасагдах");
  const c9 = await connect(await register("Салах"));
  const c10 = await connect(await register("Үлдэх"));
  await emit(c9, "queue:join");
  await emit(c10, "queue:join");
  await wait(200);
  check("Хоёулаа дараалалд", c10.last?.size === 2, `size=${c10.last?.size}`);

  c9.socket.disconnect();
  await wait(600);
  check("Салсан хүн хасагдав", c10.last?.size === 1, `size=${c10.last?.size}`);
  check("Owner үлдсэн хүн", c10.last?.ownerId === c10.user.id);

  for (const c of [c2, c10, ...clients]) c.socket.disconnect();

  console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} амжилттай, ${fail} алдаа\n`);
  process.exit(fail === 0 ? 0 : 1);
};

run().catch((e) => {
  console.error("💥", e);
  process.exit(1);
});
