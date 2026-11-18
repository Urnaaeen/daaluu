/**
 * Жанлийн шалгалт.
 *   1. Дүрэм (цэвэр функц): жанлий бүгдийг дийлнэ, ямар ч өнгөн дээр тавигдана,
 *      дангаараа гарааг нээнэ; Нохой энгийн 6 нүдтэй улаан мод болсон.
 *   2. Урсгал (тусдаа сервер, JANLII_SECONDS=2): хугацаа дуусахад санамсаргүй
 *      сонгогдоно; майхан бүрт ээлжлэн сонгоно (хост 1, 6-р майханд).
 *
 *   npm run smoke:janlii
 */
import { spawn } from "node:child_process";
import { closePool } from "../src/db.js";
import { roundWinner, validateMove, currentLead } from "../src/game/rules.js";
import { describe, describeAll, JANLII_OPTIONS, JANLII_RANK, loadTileTypes } from "../src/game/tiles.js";

const PORT = 4105;
const BASE = `http://localhost:${PORT}/api`;

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

/* ─────────── 1. Дүрэм ─────────── */

await loadTileTypes();

const J = "tsagaan_tav_Чүү тав"; // 5 нүдтэй цагаан — жанлий болгоно
const CHUU = `${J}_1`;
const CHUU2 = `${J}_2`;
const DAALUU = "ulaan_daaluu_Даалуу_1";
const DAALUU2 = "ulaan_daaluu_Даалуу_2";
const NOHOI = "ulaan_zurgaa_Нохой_1";
const YOOZ = "ulaan_hoyr_Ёоз_1";
const BAJGAR = "tsagaan_arav_Бажгар арав_1";
const SARLAG = "tsagaan_doloo_Сарлаг долоо_1";

console.log("── Модны мэдээлэл ──");
const jt = describe(CHUU, J);
check("жанлий хамгийн том эрэмбэтэй", jt.rank === JANLII_RANK && jt.isJanlii);
check("жанлий өнгөгүй (ямар ч өнгөтэй таарна)", jt.color === null);
check("жанлий биш үед Чүү тав 5 нүд", describe(CHUU).rank === 5);
const n = describe(NOHOI, J);
check("Нохой энгийн 6 нүдтэй улаан мод", n.rank === 6 && n.color === "ulaan" && !n.isJanlii);
check("8 сонголт", JANLII_OPTIONS.length === 8);

const hand = (ids) => describeAll(ids, J);
const move = (seat, ids) => ({ seat, tiles: describeAll(ids, J), isSecret: false });

console.log("── Гараа нээх ──");
check(
  "5 нүдтэй ч жанлий бол дангаараа гарна",
  validateMove({ hand: hand([CHUU, YOOZ]), tileIds: [CHUU], lead: null, janlii: J }).ok
);
check(
  "жанлий биш бол 5 нүдээр дангаар гарахгүй",
  !validateMove({ hand: describeAll([CHUU, YOOZ]), tileIds: [CHUU], lead: null }).ok
);

console.log("── Дагах / дийлэх ──");
const leadDaaluu = currentLead([move(0, [DAALUU])]);
check(
  "улаан Даалуун дээр цагаан жанлий тавигдана",
  validateMove({ hand: hand([CHUU, YOOZ]), tileIds: [CHUU], lead: leadDaaluu, janlii: J }).ok
);
check("жанлий Даалууг дийлэв", roundWinner([move(0, [DAALUU]), move(1, [CHUU])]).seat === 1);
check("Нохой Даалууг дийлэхгүй болсон", roundWinner([move(0, [DAALUU]), move(1, [NOHOI])]).seat === 0);

const leadSarlag = currentLead([move(0, [SARLAG])]);
check(
  "ахиулах мод байхад өөр өнгийн муу мод хаяхгүй",
  !validateMove({ hand: hand([BAJGAR, CHUU, YOOZ]), tileIds: [YOOZ], lead: leadSarlag, janlii: J }).ok
);
check(
  "ахиулахдаа жанлий тавьж болно",
  validateMove({ hand: hand([BAJGAR, CHUU, YOOZ]), tileIds: [CHUU], lead: leadSarlag, janlii: J }).ok
);

check(
  "хос жанлий хос Даалууг дийлэв",
  roundWinner([move(0, [DAALUU, DAALUU2]), move(1, [CHUU, CHUU2])]).seat === 1
);
const leadJ = currentLead([move(0, [CHUU])]);
check(
  "жанлийн дараа хэн ч ахиулж чадахгүй — дурын мод",
  validateMove({ hand: hand([DAALUU, YOOZ]), tileIds: [YOOZ], lead: leadJ, janlii: J }).ok
);

await closePool();

/* ─────────── 2. Урсгал ─────────── */

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
      env: { ...process.env, PORT: String(PORT), JANLII_SECONDS: "2" },
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

const server = await startServer();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const tag = Date.now().toString(36);
  const reg = await call("POST", "/auth/register", {
    body: { name: "Жанлий", email: `janlii_${tag}@test.mn`, password: "nuuts123" },
  });
  const token = reg.json.token;

  console.log("── Хугацаа дуусахад автоматаар сонгоно ──");
  const m1 = await call("POST", "/matches", { token, body: { mode: "random", turnSeconds: 0 } });
  const s1 = await call("POST", `/matches/${m1.json.matchId}/start`, { token });
  check("эхлэхэд жанлий сонгох үе", s1.json.match?.phase === "janlii" && s1.json.match?.currentSeat === 0);
  await sleep(5500); // 2с хугацаа + таймер 2с тутам
  const after = await call("GET", `/matches/${m1.json.matchId}`, { token });
  check("хугацаа дуусч автоматаар сонгогдов", after.json.match?.phase === "play", after.json.match?.phase);
  check("сонголт 8-ын нэг", JANLII_OPTIONS.includes(after.json.match?.janlii), after.json.match?.janlii);
  check("одоо гар харагдана", after.json.myHand?.length === 10);

  console.log("── Майхан бүрт ээлжлэн сонгоно (10 майхан) ──");
  const m2 = await call("POST", "/matches", {
    token,
    body: { mode: "random", turnSeconds: 0, endRule: "hands10" },
  });
  const matchId = m2.json.matchId;
  let state = (await call("POST", `/matches/${matchId}/start`, { token })).json;
  const myChoices = [];

  for (let i = 0; i < 3000 && state.match.status !== "finished"; i++) {
    if (state.match.phase === "janlii") {
      if (state.match.currentSeat !== state.mySeat) {
        state = (await call("GET", `/matches/${matchId}`, { token })).json;
        if (state.match.phase === "janlii" && state.match.currentSeat !== state.mySeat) break;
        continue;
      }
      myChoices.push(state.match.maikhanNo);
      const r = await call("POST", `/matches/${matchId}/janlii`, {
        token,
        body: { typeId: JANLII_OPTIONS[myChoices.length % 8] },
      });
      state = r.json;
      continue;
    }
    if (state.match.currentSeat !== state.mySeat) {
      state = (await call("GET", `/matches/${matchId}`, { token })).json;
      if (state.match.currentSeat !== state.mySeat && state.match.phase === "play") break;
      continue;
    }
    let played = null;
    for (const t of state.myHand) {
      const r = await call("POST", `/matches/${matchId}/play`, { token, body: { tiles: [t] } });
      if (r.status === 200) { played = r; break; }
    }
    if (!played) {
      outer: for (let a = 0; a < state.myHand.length; a++) {
        for (let b = a + 1; b < state.myHand.length; b++) {
          const r = await call("POST", `/matches/${matchId}/play`, {
            token,
            body: { tiles: [state.myHand[a], state.myHand[b]] },
          });
          if (r.status === 200) { played = r; break outer; }
        }
      }
    }
    if (!played) break;
    state = played.json;
  }

  check("10 майхан бүрэн тоглогдож дуусав", state.match.status === "finished", state.match.status);
  check(
    "хост (0-р суудал) 1, 6-р майханд сонгов — бусдыг ботууд ээлжлэн",
    JSON.stringify(myChoices) === "[1,6]",
    JSON.stringify(myChoices)
  );
} finally {
  server.kill();
}

console.log(`\n${passed} тэнцсэн, ${failed} унасан`);
process.exit(failed ? 1 : 0);
