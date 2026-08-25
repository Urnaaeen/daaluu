/**
 * Тоглоомын урсгал + хуурахаас хамгаалалтыг шалгана.
 *   node scripts/game-smoke.js
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

const newUser = async (name) => {
  const email = `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}@test.mn`;
  const r = await call("POST", "/auth/register", {
    body: { name, email, password: "nuuts123" },
  });
  return { token: r.json.token, user: r.json.user };
};

const run = async () => {
  console.log("\n── Бэлтгэл ──");
  const host = await newUser("Тэмүүлэн");
  const guest = await newUser("Хандцоож");
  check("2 тоглогч бүртгэгдэв", !!host.token && !!guest.token);

  console.log("\n── Тоглолт үүсгэх ──");
  const created = await call("POST", "/matches", {
    token: host.token,
    body: { mode: "random", turnSeconds: 0 },
  });
  check("тоглолт үүслээ", created.status === 201, JSON.stringify(created.json));
  const matchId = created.json.matchId;

  const joined = await call("POST", `/matches/${matchId}/join`, { token: guest.token });
  check("хоёр дахь тоглогч нэгдлээ", joined.json.seat === 1, JSON.stringify(joined.json));

  console.log("\n── Эхлүүлэх эрх ──");
  const notHost = await call("POST", `/matches/${matchId}/start`, { token: guest.token });
  check("хост биш эхлүүлж чадсангүй", notHost.json.error === "not_host", JSON.stringify(notHost.json));

  const started = await call("POST", `/matches/${matchId}/start`, { token: host.token });
  check("хост эхлүүллээ", started.status === 200, JSON.stringify(started.json));
  check("статус playing", started.json.match?.status === "playing");
  check("5 суудал бүрдэв", started.json.players?.length === 5);
  check("3 суудал ботоор нөхөгдөв", started.json.players?.filter((p) => p.isBot).length === 3);

  console.log("\n── Нууц гар ──");
  check("өөрийн гар 10 модтой", started.json.myHand?.length === 10, String(started.json.myHand?.length));
  check(
    "бусдын мод харагдахгүй",
    started.json.players.every((p) => p.isMe || p.tilesLeft === 10) &&
      !JSON.stringify(started.json.players).includes("_1")
  );

  const guestState = await call("GET", `/matches/${matchId}`, { token: guest.token });
  const hostHand = new Set(started.json.myHand);
  const guestHand = guestState.json.myHand ?? [];
  check("хоёр тоглогчийн гар өөр", guestHand.every((t) => !hostHand.has(t)));
  check("гар давхцахгүй (тарааалт зөв)", new Set([...hostHand, ...guestHand]).size === 20);

  console.log("\n── Ээлж ──");
  const outOfTurn = await call("POST", `/matches/${matchId}/play`, {
    token: guest.token,
    body: { tiles: [guestHand[0]] },
  });
  check("ээлжгүй тоглогч татгалзав", outOfTurn.json.error === "not_your_turn", JSON.stringify(outOfTurn.json));

  console.log("\n── Хуурах оролдлогууд ──");
  const notMine = await call("POST", `/matches/${matchId}/play`, {
    token: host.token,
    body: { tiles: [guestHand[0]] },
  });
  check("бусдын мод гаргаж чадсангүй", notMine.json.error === "illegal_move", JSON.stringify(notMine.json));

  const fake = await call("POST", `/matches/${matchId}/play`, {
    token: host.token,
    body: { tiles: ["ulaan_daaluu_Даалуу_99"] },
  });
  check("байхгүй мод татгалзав", fake.json.error === "illegal_move");

  const tooMany = await call("POST", `/matches/${matchId}/play`, {
    token: host.token,
    body: { tiles: [...hostHand].slice(0, 3) },
  });
  check("3 мод татгалзав", tooMany.json.error === "illegal_move");

  const dup = await call("POST", `/matches/${matchId}/play`, {
    token: host.token,
    body: { tiles: [started.json.myHand[0], started.json.myHand[0]] },
  });
  check("ижил модыг хоёр удаа татгалзав", dup.json.error === "illegal_move");

  console.log("\n── Гар нээх дүрэм ──");
  // Сервер модны эрэмбийг мэддэг тул хамгийн жижиг модыг нь олж туршина
  const tileInfo = await call("GET", "/health/tiles");
  const rankOf = new Map((tileInfo.json.tiles ?? []).map((t) => [t.type_id, t.rank]));
  const typeOf = (id) => id.replace(/_(\d+)$/, "");

  const weak = started.json.myHand.find((id) => (rankOf.get(typeOf(id)) ?? 0) < 8);
  if (weak) {
    const bad = await call("POST", `/matches/${matchId}/play`, {
      token: host.token,
      body: { tiles: [weak] },
    });
    check("8-аас доош модоор гарч чадсангүй", bad.json.error === "illegal_move", JSON.stringify(bad.json));
  } else {
    check("8-аас доош мод гарт байсангүй (алгасав)", true);
  }

  const strong = started.json.myHand.find((id) => (rankOf.get(typeOf(id)) ?? 0) >= 8);
  check("8-аас дээш мод гарт бий", !!strong);

  if (strong) {
    const play = await call("POST", `/matches/${matchId}/play`, {
      token: host.token,
      body: { tiles: [strong] },
    });
    check("хүчинтэй мод гарлаа", play.status === 200, JSON.stringify(play.json));
    check("гар 9 мод үлдлээ", play.json.myHand?.length === 9, String(play.json.myHand?.length));
    check("ээлж дараагийн суудалд шилжив", play.json.match?.currentSeat === 1);
    check("хөдөлгөөн бүртгэгдэв", play.json.moves?.length === 1);

    const twice = await call("POST", `/matches/${matchId}/play`, {
      token: host.token,
      body: { tiles: [play.json.myHand[0]] },
    });
    check("нэг гарт хоёр удаа гаргаж чадсангүй", twice.json.error === "not_your_turn");
  }

  console.log("\n── Гадны хүн ──");
  const stranger = await newUser("Танихгүй");
  const peek = await call("POST", `/matches/${matchId}/play`, {
    token: stranger.token,
    body: { tiles: ["ulaan_daaluu_Даалуу_1"] },
  });
  check("тоглолтод байхгүй хүн татгалзав", peek.json.error === "not_in_match", JSON.stringify(peek.json));

  const strangerView = await call("GET", `/matches/${matchId}`, { token: stranger.token });
  check("гадны хүнд гар харагдахгүй", (strangerView.json.myHand ?? []).length === 0);

  console.log(`\n${passed} тэнцсэн, ${failed} унасан\n`);
  process.exitCode = failed ? 1 : 0;
};

run().catch((err) => {
  console.error("Script алдаа:", err);
  process.exitCode = 1;
});
