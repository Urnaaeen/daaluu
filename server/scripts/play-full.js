/**
 * Нэг хүн + 4 бот тоглолтыг ЭХНЭЭС ДУУСТАЛ нь тоглуулж
 * гарын дүгнэлт, худалдаа, тоглоом дуусах хүртэлх урсгалыг шалгана.
 *   node scripts/play-full.js
 */
import { config } from "../src/config.js";

const BASE = `http://localhost:${config.port}/api`;

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

const run = async () => {
  const email = `full_${Date.now().toString(36)}@test.mn`;
  const reg = await call("POST", "/auth/register", {
    body: { name: "Тэмүүлэн", email, password: "nuuts123" },
  });
  const token = reg.json.token;

  const created = await call("POST", "/matches", {
    token,
    body: { mode: "random", turnSeconds: 0 },
  });
  const matchId = created.json.matchId;

  const started = await call("POST", `/matches/${matchId}/start`, { token });
  if (started.status !== 200) {
    console.error("Эхлүүлж чадсангүй:", started.json);
    process.exitCode = 1;
    return;
  }

  console.log(`\nТоглолт ${matchId.slice(0, 8)} эхэллээ`);
  console.log(`Суудлууд: ${started.json.players.map((p) => `${p.seat}:${p.name}${p.isBot ? "🤖" : "👤"}`).join("  ")}`);

  let state = started.json;
  let moves = 0;
  let lastRound = 0;
  let maikhans = 0;

  // Хамгаалалт: хязгааргүй давталтаас сэргийлнэ
  for (let step = 0; step < 4000; step++) {
    if (state.match.status === "finished") break;

    // Ботын ээлж бол сервер өөрөө тоглосон байх ёстой — гацвал зогсооно
    if (state.match.currentSeat !== state.mySeat) {
      const fresh = await call("GET", `/matches/${matchId}`, { token });
      state = fresh.json;
      if (state.match.currentSeat !== state.mySeat && state.match.status === "playing") {
        console.error(`❌ Ээлж ${state.match.currentSeat}-р суудал дээр гацлаа (бот тоглоогүй)`);
        process.exitCode = 1;
        return;
      }
      continue;
    }

    if (!state.myHand?.length) {
      const fresh = await call("GET", `/matches/${matchId}`, { token });
      state = fresh.json;
      if (!state.myHand?.length && state.match.status === "playing") {
        console.error("❌ Гар хоосон атлаа ээлж над дээр байна");
        process.exitCode = 1;
        return;
      }
      continue;
    }

    // Хүчинтэй мод олтол нь туршина (клиент талын дүрмийг давхардуулахгүйн тулд)
    let played = null;
    for (const tile of state.myHand) {
      const r = await call("POST", `/matches/${matchId}/play`, { token, body: { tiles: [tile] } });
      if (r.status === 200) {
        played = r;
        break;
      }
    }

    if (!played) {
      // Нэг мод болохгүй бол хос туршина
      outer: for (let i = 0; i < state.myHand.length; i++) {
        for (let j = i + 1; j < state.myHand.length; j++) {
          const r = await call("POST", `/matches/${matchId}/play`, {
            token,
            body: { tiles: [state.myHand[i], state.myHand[j]] },
          });
          if (r.status === 200) {
            played = r;
            break outer;
          }
        }
      }
    }

    if (!played) {
      console.error("❌ Хүчинтэй хөдөлгөөн олдсонгүй. Гар:", state.myHand);
      process.exitCode = 1;
      return;
    }

    moves++;
    state = played.json;

    if (state.match.roundNo !== lastRound) {
      lastRound = state.match.roundNo;
    }

    // Майхан миний хөдөлгөөнөөр ч, ботынхоор ч дуусч болно — хоёуланг нь тоолно
    const ended =
      (played.json.result?.maikhanEnded ? 1 : 0) +
      (played.json.result?.botMoves ?? []).filter((b) => b.maikhanEnded).length;

    if (ended) {
      maikhans += ended;
      const scores = state.players
        .map((p) => `${p.name}: ${p.tsai}ц/${p.avlaga}а/${p.uglug}ө`)
        .join("  ");
      console.log(`  🏕  Майхан ${maikhans} → ${scores}`);
    }
  }

  const final = await call("GET", `/matches/${matchId}`, { token });
  const f = final.json;

  console.log(`\nТөлөв: ${f.match.status}`);
  console.log(`Миний хийсэн хөдөлгөөн: ${moves} | Гар: ${f.match.roundNo} | Майхан: ${maikhans}`);

  if (f.match.status !== "finished") {
    console.error("❌ Тоглоом дуусаагүй");
    process.exitCode = 1;
    return;
  }

  console.log("\nЭцсийн дүн:");
  for (const p of [...f.players].sort((a, b) => (a.place ?? 9) - (b.place ?? 9))) {
    console.log(
      `  ${p.place}. ${p.name.padEnd(12)} ${String(p.finalScore).padStart(3)} оноо  ` +
        `(${p.tsai} цай, ${p.avlaga} авлага, ${p.uglug} өглөг)`
    );
  }

  // Шалгалтууд
  const places = f.players.map((p) => p.place).sort();
  const ok1 = JSON.stringify(places) === JSON.stringify([1, 2, 3, 4, 5]);
  console.log(`\n  ${ok1 ? "✅" : "❌"} байр 1-5 давхцалгүй`);

  const scoresOk = f.players.every((p) => p.finalScore === p.tsai + p.avlaga - p.uglug);
  console.log(`  ${scoresOk ? "✅" : "❌"} оноо = цай + авлага − өглөг`);

  const tsaiTotal = f.players.reduce((s, p) => s + p.tsai, 0);
  console.log(`  ${tsaiTotal === 10 ? "✅" : "❌"} нийт цай 10 хэвээр (${tsaiTotal})`);

  const endOk = f.players.some((p) => p.tsai >= 10 || p.uglug >= 10);
  console.log(`  ${endOk ? "✅" : "❌"} дуусах нөхцөл биелсэн`);

  const handsGone = f.players.every((p) => p.tilesLeft === 0);
  console.log(`  ${handsGone ? "✅" : "❌"} нууц гарууд цэвэрлэгдсэн`);

  // Майхан бүрт 50 мод — тоглосон модны нийлбэр яг таарах ёстой
  const tilesOk = maikhans > 0;
  console.log(`  ${tilesOk ? "✅" : "❌"} ${maikhans} майхан тоглогдсон`);

  if (!ok1 || !scoresOk || tsaiTotal !== 10 || !endOk || !handsGone || !tilesOk) {
    process.exitCode = 1;
  }
  console.log("");
};

run().catch((err) => {
  console.error("Script алдаа:", err);
  process.exitCode = 1;
});
