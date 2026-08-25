/**
 * socket.io realtime ба ээлжийн таймерыг шалгана.
 *   node scripts/realtime-smoke.js
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
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

const newUser = async (name) => {
  const email = `rt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}@test.mn`;
  const r = await call("POST", "/auth/register", { body: { name, email, password: "nuuts123" } });
  return { token: r.json.token, user: r.json.user };
};

const connect = (token) =>
  new Promise((resolve, reject) => {
    const socket = ioClient(HTTP, { auth: { token }, transports: ["websocket"] });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", (err) => reject(err));
    setTimeout(() => reject(new Error("timeout")), 5000);
  });

const waitFor = (socket, event, ms = 6000) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

/** Нөхцөл хангасан мэдээлэл ирэх хүртэл хүлээнэ (өмнөх цацалтуудыг алгасна) */
const waitUntil = (socket, event, predicate, ms = 12000) =>
  new Promise((resolve) => {
    const onEvent = (payload) => {
      if (predicate(payload)) {
        clearTimeout(timer);
        socket.off(event, onEvent);
        resolve(payload);
      }
    };
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      resolve(null);
    }, ms);
    socket.on(event, onEvent);
  });

const run = async () => {
  console.log("\n── Холболт ──");
  const host = await newUser("Тэмүүлэн");
  const guest = await newUser("Хандцоож");

  let rejected = false;
  try {
    await connect("garbage-token");
  } catch {
    rejected = true;
  }
  check("буруу токен холбогдсонгүй", rejected);

  const hostSock = await connect(host.token);
  const guestSock = await connect(guest.token);
  check("хоёр тоглогч холбогдлоо", hostSock.connected && guestSock.connected);

  console.log("\n── Тоглолтод нэгдэх ──");
  const created = await call("POST", "/matches", {
    token: host.token,
    body: { mode: "random", turnSeconds: 0 },
  });
  const matchId = created.json.matchId;
  await call("POST", `/matches/${matchId}/join`, { token: guest.token });

  const hostJoin = await new Promise((r) => hostSock.emit("match:join", matchId, r));
  const guestJoin = await new Promise((r) => guestSock.emit("match:join", matchId, r));
  check("хост өрөөнд орлоо", hostJoin?.ok === true, JSON.stringify(hostJoin));
  check("зочин өрөөнд орлоо", guestJoin?.ok === true, JSON.stringify(guestJoin));

  console.log("\n── Төлөв цацагдах ──");
  const guestUpdate = waitFor(guestSock, "match:state");
  await call("POST", `/matches/${matchId}/start`, { token: host.token });
  const pushed = await guestUpdate;

  check("зочинд шинэчлэл ирлээ", !!pushed, "мэдээлэл ирсэнгүй");
  check("статус playing", pushed?.match?.status === "playing");
  check("зочин өөрийн 10 модоо авлаа", pushed?.myHand?.length === 10, String(pushed?.myHand?.length));

  // Хостын гартай харьцуулж нууцлал зөрчигдөөгүйг шалгана
  const hostState = await call("GET", `/matches/${matchId}`, { token: host.token });
  const hostHand = new Set(hostState.json.myHand ?? []);
  check(
    "цацсан мэдээлэлд бусдын мод алга",
    (pushed?.myHand ?? []).every((t) => !hostHand.has(t))
  );
  check(
    "бусдаас зөвхөн модны тоо харагдана",
    (pushed?.players ?? []).every((p) => p.isMe || typeof p.tilesLeft === "number")
  );

  console.log("\n── Ээлжийн таймер ──");
  const timed = await call("POST", "/matches", {
    token: host.token,
    body: { mode: "random", turnSeconds: 1 },
  });
  const timedId = timed.json.matchId;
  await new Promise((r) => hostSock.emit("match:join", timedId, r));
  const before = await call("POST", `/matches/${timedId}/start`, { token: host.token });

  const beforeCount = before.json.myHand?.length ?? 0;

  // Гар багасах хүртэл хүлээнэ — start-ын цацалтыг алгасна.
  // Таймер 2 секунд тутам ажиллана.
  const autoUpdate = await waitUntil(
    hostSock,
    "match:state",
    (s) => (s.myHand?.length ?? 99) < beforeCount,
    12000
  );

  check("хугацаа дуусахад автомат мод гарлаа", !!autoUpdate, "өөрчлөлт ирсэнгүй");
  if (autoUpdate) {
    check(
      "гар багасав",
      autoUpdate.myHand.length < beforeCount,
      `${beforeCount} → ${autoUpdate.myHand.length}`
    );
  }

  hostSock.close();
  guestSock.close();

  console.log(`\n${passed} тэнцсэн, ${failed} унасан\n`);
  process.exitCode = failed ? 1 : 0;
};

run().catch((err) => {
  console.error("Script алдаа:", err);
  process.exitCode = 1;
});
