/**
 * Төгсгөлийн 4 дүрэм тус бүрээр тоглолт дуусч байгааг шалгана.
 *   node scripts/end-rules-smoke.js
 */
import { config } from "../src/config.js";

const BASE = `http://localhost:${config.port}/api`;

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

const newUser = async () => {
  const email = `er_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}@test.mn`;
  const r = await call("POST", "/auth/register", {
    body: { name: "Тэмүүлэн", email, password: "nuuts123" },
  });
  return r.json.token;
};

/** Нэг тоглолтыг дуустал нь тоглоно. @returns эцсийн төлөв */
const playToEnd = async (token, endRule, maxMoves = 3000) => {
  const created = await call("POST", "/matches", {
    token,
    body: { mode: "random", turnSeconds: 0, endRule },
  });
  const matchId = created.json.matchId;
  const started = await call("POST", `/matches/${matchId}/start`, { token });
  let state = started.json;

  for (let i = 0; i < maxMoves; i++) {
    if (state.match.status === "finished") break;

    if (state.match.currentSeat !== state.mySeat || !state.myHand?.length) {
      const fresh = await call("GET", `/matches/${matchId}`, { token });
      state = fresh.json;
      if (state.match.status === "finished") break;
      if (state.match.currentSeat !== state.mySeat) return { stuck: true, state };
      if (!state.myHand?.length) return { stuck: true, state };
      continue;
    }

    let played = null;
    for (const tile of state.myHand) {
      const r = await call("POST", `/matches/${matchId}/play`, { token, body: { tiles: [tile] } });
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
    if (!played) return { stuck: true, state };
    state = played.json;
  }

  const final = await call("GET", `/matches/${matchId}`, { token });
  return { state: final.json, matchId };
};

const run = async () => {
  const token = await newUser();

  console.log("\n── Дүрмийн жагсаалт ──");
  const rules = await call("GET", "/matches/end-rules", { token });
  check("4 дүрэм ирлээ", rules.json.rules?.length === 4, JSON.stringify(rules.json.rules?.length));
  check("Gamer хаалттай", rules.json.gamer?.unlocked === false, JSON.stringify(rules.json.gamer));
  check("шаардлага 20 ялалт", rules.json.gamer?.required === 20);

  const bad = await call("POST", "/matches", {
    token,
    body: { mode: "random", endRule: "hakker" },
  });
  check("буруу дүрэм татгалзав", bad.json.error === "bad_end_rule", JSON.stringify(bad.json));

  console.log("\n── 4. Нэг л удаа хуваах (single) ──");
  {
    const { state, stuck } = await playToEnd(token, "single");
    check("дууссан", !stuck && state.match.status === "finished", stuck ? "гацсан" : state.match?.status);
    check("1 удаа хуваасан", state.match?.maikhanNo === 1, `maikhanNo=${state.match?.maikhanNo}`);
    check("байр бүгдэд өгсөн", state.players?.every((p) => p.place >= 1 && p.place <= 5));
  }

  console.log("\n── 1. 10 удаа мод хуваах (hands10) ──");
  {
    const { state, stuck } = await playToEnd(token, "hands10");
    check("дууссан", !stuck && state.match.status === "finished", stuck ? "гацсан" : state.match?.status);
    check("10 удаа хуваасан", state.match?.maikhanNo === 10, `maikhanNo=${state.match?.maikhanNo}`);
  }

  console.log("\n── 3. 6 өглөгтэй болох (uglug6) ──");
  {
    const { state, stuck } = await playToEnd(token, "uglug6");
    check("дууссан", !stuck && state.match.status === "finished", stuck ? "гацсан" : state.match?.status);
    const maxUglug = Math.max(...(state.players ?? []).map((p) => p.uglug));
    check("хэн нэгэн 6-аас дээш өглөгтэй", maxUglug > 6, `хамгийн их өглөг=${maxUglug}`);
  }

  console.log("\n── 2. 10 цайд хүрэх (tsai10) ──");
  {
    const { state, stuck } = await playToEnd(token, "tsai10");
    check("дууссан", !stuck && state.match.status === "finished", stuck ? "гацсан" : state.match?.status);
    const best = Math.max(...(state.players ?? []).map((p) => p.tsai + p.avlaga - p.uglug));
    check("хэн нэгэн 10 оноонд хүрсэн", best >= 10, `хамгийн өндөр оноо=${best}`);
  }

  console.log(`\n${passed} тэнцсэн, ${failed} унасан\n`);
  process.exitCode = failed ? 1 : 0;
};

run().catch((err) => {
  console.error("Script алдаа:", err);
  process.exitCode = 1;
});
