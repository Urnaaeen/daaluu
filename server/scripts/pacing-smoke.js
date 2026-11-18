/**
 * Ботын хурдны шалгалт (онлайн тоглолт боттой горим шиг харагдах эсэх).
 * Тусдаа сервер: BOT_DELAY_MS=400, ROUND_PAUSE_MS=1200.
 *
 *   - Хүн мод гаргахад ботууд ШУУД биш, нэг нэгээрээ зайтай тоглоно
 *   - Нүүдэл бүр тусдаа match:state болж апп руу очно (ширээн дээр харагдана)
 *   - Гар дуусахад lastRound 5 суудлын модтой ирж, дараагийн алхам завсарлагатай
 *
 *   npm run smoke:pacing
 */
import { spawn } from "node:child_process";
import { io as ioClient } from "socket.io-client";

const PORT = 4106;
const HTTP = `http://localhost:${PORT}`;
const BASE = `${HTTP}/api`;
const BOT_DELAY = 400;
const ROUND_PAUSE = 1200;

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

const startServer = () =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["src/index.js"], {
      env: {
        ...process.env,
        PORT: String(PORT),
        BOT_DELAY_MS: String(BOT_DELAY),
        ROUND_PAUSE_MS: String(ROUND_PAUSE),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    child.stdout.on("data", (d) => {
      log += d;
      if (log.includes("Postgres бэлэн")) resolve(child);
    });
    child.stderr.on("data", (d) => (log += d));
    child.on("exit", (code) => reject(new Error(`сервер унтарлаа (${code}):\n${log}`)));
    setTimeout(() => reject(new Error(`сервер асаагүй:\n${log}`)), 15000);
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await startServer();
let socket;

try {
  const tag = Date.now().toString(36);
  const reg = await call("POST", "/auth/register", {
    body: { name: "Хурд", email: `pace_${tag}@test.mn`, password: "nuuts123" },
  });
  const token = reg.json.token;

  socket = ioClient(HTTP, { auth: { token }, transports: ["websocket"] });
  await new Promise((r, j) => {
    socket.on("connect", r);
    socket.on("connect_error", j);
  });

  // Нүүдэл тус бүрийн төлөвийг цагтай нь бичнэ
  const states = [];
  socket.on("match:state", (s) => states.push({ at: Date.now(), s }));

  const m = await call("POST", "/matches", { token, body: { mode: "random", turnSeconds: 0 } });
  const matchId = m.json.matchId;
  await new Promise((r) => socket.emit("match:join", matchId, r));
  await call("POST", `/matches/${matchId}/start`, { token });

  console.log("── Жанлийн дараа хост гарна ──");
  let st = (await call("POST", `/matches/${matchId}/janlii`, {
    token,
    body: { typeId: "ulaan_zurgaa_Нохой" },
  })).json;
  // Хост гарааг нээх эрхгүй бол ботууд эхэлнэ — тэр тохиолдолд хостын ээлж хүртэл хүлээнэ
  for (let i = 0; i < 40 && st.match.currentSeat !== st.mySeat; i++) {
    await sleep(200);
    st = (await call("GET", `/matches/${matchId}`, { token })).json;
  }
  check("хостын ээлж ирэв", st.match.currentSeat === st.mySeat);
  const roundNo = st.match.roundNo;
  const before = st.moves.length;

  let played = null;
  for (const t of st.myHand) {
    const r = await call("POST", `/matches/${matchId}/play`, { token, body: { tiles: [t] } });
    if (r.status === 200) { played = r; break; }
  }
  if (!played) {
    outer: for (let a = 0; a < st.myHand.length; a++) {
      for (let b = a + 1; b < st.myHand.length; b++) {
        const r = await call("POST", `/matches/${matchId}/play`, {
          token,
          body: { tiles: [st.myHand[a], st.myHand[b]] },
        });
        if (r.status === 200) { played = r; break outer; }
      }
    }
  }
  const playedAt = Date.now();
  check("хост мод гаргав", !!played);

  console.log("── Ботууд нэг нэгээрээ ──");
  const expectBots = 4 - before; // энэ гарт үлдсэн ботын тоо
  check(
    "хариунд ботууд ШУУД тоглоогүй (зөвхөн миний мод нэмэгдэв)",
    played.json.moves.length === before + 1,
    `${played.json.moves.length}`
  );

  // Бүх бот тоглож гар дуустал хүлээнэ
  const deadline = Date.now() + expectBots * BOT_DELAY + ROUND_PAUSE + 6000;
  while (Date.now() < deadline) {
    const done = states.some((x) => x.s.lastRound?.roundNo === roundNo);
    if (done) break;
    await sleep(100);
  }

  const after = states.filter((x) => x.at >= playedAt);
  const inRound = after.filter((x) => x.s.match.roundNo === roundNo && x.s.moves.length > before + 1);
  const counts = [...new Set(inRound.map((x) => x.s.moves.length))];
  check(
    "ботын нүүдэл бүр тусдаа төлөв болж ирэв (ширээн дээр харагдана)",
    counts.length >= Math.max(1, expectBots - 1),
    JSON.stringify(counts)
  );

  const firstBot = inRound[0]?.at ?? Infinity;
  check(
    `эхний бот ~${BOT_DELAY}мс хүлээж тоглов`,
    firstBot - playedAt >= BOT_DELAY * 0.7,
    `${firstBot - playedAt}мс`
  );

  const gaps = inRound.slice(1).map((x, i) => x.at - inRound[i].at).filter((g) => g > 50);
  check(
    "ботуудын хооронд зай бий",
    gaps.every((g) => g >= BOT_DELAY * 0.7),
    JSON.stringify(gaps)
  );

  console.log("── Гар дуусахад ──");
  const endState = states.find((x) => x.s.lastRound?.roundNo === roundNo);
  check("lastRound ирэв", !!endState);
  check(
    "lastRound-д 5 суудлын мод бүгд байна",
    endState?.s.lastRound.plays.filter(Boolean).length === 5,
    JSON.stringify(endState?.s.lastRound?.plays?.map((p) => p?.length ?? 0))
  );
  check("ялагч тодорхой", endState && endState.s.lastRound.winnerSeat >= 0);

  // Дараагийн гарыг бот эхлэх бол ROUND_PAUSE хүлээх ёстой
  if (endState && endState.s.match.currentSeat !== endState.s.mySeat) {
    await sleep(ROUND_PAUSE + BOT_DELAY + 1500);
    const next = states.find((x) => x.at > endState.at && x.s.match.roundNo === roundNo + 1 && x.s.moves.length > 0);
    check(
      `шинэ гарын эхний бот ~${ROUND_PAUSE}мс завсарлагын дараа`,
      next && next.at - endState.at >= ROUND_PAUSE * 0.7,
      next ? `${next.at - endState.at}мс` : "ирсэнгүй"
    );
  } else {
    check("шинэ гарыг хост эхэлнэ (завсарлагын шалгалт алгасав)", true);
  }
} finally {
  socket?.close();
  server.kill();
}

console.log(`\n${passed} тэнцсэн, ${failed} унасан`);
process.exit(failed ? 1 : 0);
