/**
 * Найзтайгаа тоглох урсгал (Firebase-ийн "кодоор нэгдэх"-ийг орлосон):
 *   эзэн өрөө авна → найзууд 4 оронтой кодоор нэгдэнэ → эзэн тоглолт нээнэ
 *   → найзуудад socket-оор урилга ирнэ → нэгдэнэ → эхэлнэ → бүгд ширээнд.
 *   node scripts/friends-smoke.js
 */
import { io as ioClient } from "socket.io-client";
import { config } from "../src/config.js";

const ORIGIN = `http://localhost:${config.port}`;
const BASE = `${ORIGIN}/api`;

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
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

const tag = Date.now().toString(36);
const register = async (name) => {
  const r = await call("POST", "/auth/register", {
    body: { name, email: `fr_${name}_${tag}@test.mn`, password: "nuuts12345" },
  });
  return { token: r.json.token, user: r.json.user };
};

const connect = (token) =>
  new Promise((resolve, reject) => {
    const s = ioClient(ORIGIN, { auth: { token }, transports: ["websocket"] });
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
  });

const waitFor = (socket, event, ms = 4000) =>
  new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    socket.once(event, (p) => {
      clearTimeout(t);
      resolve(p);
    });
  });

const run = async () => {
  const host = await register("Эзэн");
  const a = await register("Бат");
  const b = await register("Сараа");
  const stranger = await register("Гадны");
  check("4 хэрэглэгч бүртгэгдэв", host.token && a.token && b.token && stranger.token);

  // Эзэн зоос авч өрөө худалдаж авна
  const inv = await call("POST", "/coins/invoice", { token: host.token, body: { packId: "p120" } });
  const paymentId = inv.json.payment?.id ?? inv.json.paymentId ?? inv.json.id;
  await call("POST", `/coins/invoice/${paymentId}/demo-pay`, { token: host.token });
  const room = await call("POST", "/rooms", { token: host.token, body: { name: "Гэр бүлийн өрөө" } });
  const code = room.json.room?.code;
  check("эзэн өрөө авав", room.status === 201 && /^\d{4}$/.test(code ?? ""), JSON.stringify(room.json));

  // Буруу код
  const bad = await call("POST", "/rooms/join", { token: a.token, body: { code: "12" } });
  check("буруу формат татгалзав", bad.json.error === "bad_code");

  // Найзууд кодоор нэгдэнэ (тоглолт хараахан нээгдээгүй)
  const ja = await call("POST", "/rooms/join", { token: a.token, body: { code } });
  check("Бат кодоор нэгдэв", ja.status === 200 && ja.json.room?.ownerName === "Эзэн", JSON.stringify(ja.json));
  check("тоглолт хараахан нээгдээгүй", ja.json.matchId === null);
  const again = await call("POST", "/rooms/join", { token: a.token, body: { code } });
  check("дахин нэгдэхэд алдаагүй", again.status === 200);

  const joined = await call("GET", "/rooms/joined", { token: a.token });
  check("Батын өрөөнүүдэд харагдав", joined.json.rooms?.some((r) => r.code === code));

  const members = await call("GET", `/rooms/${room.json.room.id}/members`, { token: host.token });
  check("эзэнд гишүүн 'joined' харагдав", members.json.members?.some((m) => m.name === "Бат" && m.status === "joined"));

  // Эзэн ID-гаар Сараа-г урина (кодгүй урих зам)
  const invite = await call("POST", `/rooms/${room.json.room.id}/invite`, {
    token: host.token,
    body: { playerCode: b.user.playerCode },
  });
  check("Сараа ID-гаар уригдав", invite.status === 201, JSON.stringify(invite.json));

  // Найзуудын socket — урилга хүлээнэ
  const sa = await connect(a.token);
  const sb = await connect(b.token);
  const sx = await connect(stranger.token);
  const gotA = waitFor(sa, "room:match");
  const gotB = waitFor(sb, "room:match");
  const gotX = waitFor(sx, "room:match", 1500);

  const created = await call("POST", "/matches", {
    token: host.token,
    body: { mode: "friends", roomId: room.json.room.id, endRule: "single" },
  });
  const matchId = created.json.matchId;
  check("эзэн тоглолт нээв", created.status === 201 && matchId);

  const [evA, evB, evX] = await Promise.all([gotA, gotB, gotX]);
  check("Батад урилга ирэв", evA?.matchId === matchId && evA?.hostName === "Эзэн", JSON.stringify(evA));
  check("уригдсан Сараад урилга ирэв", evB?.matchId === matchId);
  check("гадны хүнд урилга ирсэнгүй", evX === null);

  // Гадны хүн matchId мэдсэн ч орж чадахгүй
  const sneak = await call("POST", `/matches/${matchId}/join`, { token: stranger.token });
  check("гишүүн бус хүн нэгдэж чадсангүй", sneak.json.error === "not_room_member", JSON.stringify(sneak.json));

  // Код дахин оруулахад нээлттэй тоглолтын id ирнэ
  const ja2 = await call("POST", "/rooms/join", { token: a.token, body: { code } });
  check("кодоор орохад нээлттэй тоглолт ирэв", ja2.json.matchId === matchId);

  const j1 = await call("POST", `/matches/${matchId}/join`, { token: a.token });
  const j2 = await call("POST", `/matches/${matchId}/join`, { token: b.token });
  check("Бат, Сараа ширээнд суув", j1.status === 200 && j2.status === 200, JSON.stringify([j1.json, j2.json]));

  // Эзэн эхлүүлнэ — найзуудад socket-оор төлөв очно
  sa.emit("match:join", matchId);
  const playingA = new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 5000);
    sa.on("match:state", (s) => {
      if (s.match.status === "playing") {
        clearTimeout(t);
        resolve(s);
      }
    });
  });
  await new Promise((r) => setTimeout(r, 300));
  const start = await call("POST", `/matches/${matchId}/start`, { token: host.token });
  check("тоглолт эхлэв", start.json.match?.status === "playing", JSON.stringify(start.json).slice(0, 200));

  const st = await playingA;
  check("Батад 'playing' төлөв socket-оор ирэв", !!st);
  check("3 хүн + 2 бот", st?.players.filter((p) => !p.isBot).length === 3 && st?.players.length === 5);
  check("жанлий сонгогдох хүртэл Батад гар харагдахгүй", st?.match?.phase === "janlii" && (st?.myHand ?? []).length === 0);

  // Өрөөний эзэн жанлий сонгоно — дараа нь Бат өөрийн 10 модоо авна
  const handA = new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 5000);
    sa.on("match:state", (s) => {
      if (s.myHand?.length === 10) {
        clearTimeout(t);
        resolve(s);
      }
    });
  });
  const pick = await call("POST", `/matches/${matchId}/janlii`, {
    token: host.token,
    body: { typeId: "ulaan_zurgaa_Нохой" },
  });
  check("өрөөний эзэн жанлий сонголоо", pick.status === 200 && pick.json.match?.janlii === "ulaan_zurgaa_Нохой");
  const stA = await handA;
  check("Батад зөвхөн өөрийн 10 мод", stA?.myHand?.length === 10);

  const late = await call("POST", "/rooms/join", { token: a.token, body: { code } });
  check("эхэлсэн тоглолтыг 'playing' гэж мэдээлэв", late.json.playing === true && late.json.matchId === null);

  // Хасагдсан хүн кодоор буцаж орж чадахгүй
  await call("DELETE", `/rooms/${room.json.room.id}/members/${b.user.id}`, { token: host.token });
  const rejoin = await call("POST", "/rooms/join", { token: b.token, body: { code } });
  check("хасагдсан хүн кодоор орж чадсангүй", rejoin.json.error === "removed");

  for (const s of [sa, sb, sx]) s.disconnect();
  console.log(`\n${passed} тэнцсэн, ${failed} унасан`);
  process.exit(failed ? 1 : 0);
};

run().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
