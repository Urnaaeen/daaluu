/**
 * Санамсаргүй тоглогчийн дарааллыг шалгана.
 *   node scripts/queue-smoke.js
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
  const email = `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}@test.mn`;
  const r = await call("POST", "/auth/register", { name, email, password: "nuuts123" });
  return { token: r.token, user: r.user };
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
    socket.emit(event, payload, (res) => {
      done = true;
      resolve(res);
    });
    setTimeout(() => !done && resolve(null), 4000);
  });

/** queue:update-ийг нөхцөл хангах хүртэл хүлээнэ */
const waitQueue = (socket, predicate, ms = 5000) =>
  new Promise((resolve) => {
    const onEvent = (state) => {
      if (predicate(state)) {
        clearTimeout(timer);
        socket.off("queue:update", onEvent);
        resolve(state);
      }
    };
    const timer = setTimeout(() => {
      socket.off("queue:update", onEvent);
      resolve(null);
    }, ms);
    socket.on("queue:update", onEvent);
  });

const run = async () => {
  const a = await newUser("Тэмүүлэн");
  const b = await newUser("Хандцоож");
  const c = await newUser("Шижир");

  const sa = await connect(a.token);
  const sb = await connect(b.token);
  const sc = await connect(c.token);

  console.log("\n── Дараалалд орох ──");
  const ra = await emit(sa, "queue:join", {});
  check("эхний хүн орлоо", ra?.ok === true, JSON.stringify(ra));
  check("дараалал 1", ra?.state?.size === 1, String(ra?.state?.size));
  check("эхний хүн эзэн боллоо", ra?.state?.ownerId === a.user.id);
  check("анхны дүрэм single", ra?.state?.endRule === "single", ra?.state?.endRule);
  check("нэр дамжсан", ra?.state?.players?.[0]?.name === "Тэмүүлэн");

  console.log("\n── Хоёр дахь хүн ──");
  const waitTwo = waitQueue(sa, (s) => s.size === 2);
  const rb = await emit(sb, "queue:join", {});
  const seenByA = await waitTwo;
  check("хоёр дахь хүн орлоо", rb?.state?.size === 2, String(rb?.state?.size));
  check("эхний хүн шинэчлэл авав", !!seenByA, "queue:update ирсэнгүй");
  check("эзэн хэвээр эхнийх", seenByA?.ownerId === a.user.id);
  check("дараалал зөв эрэмбэтэй",
    seenByA?.players?.map((p) => p.name).join(",") === "Тэмүүлэн,Хандцоож",
    seenByA?.players?.map((p) => p.name).join(","));

  console.log("\n── Давхар орох ──");
  const again = await emit(sa, "queue:join", {});
  check("давхар орсонгүй", again?.state?.size === 2, String(again?.state?.size));

  console.log("\n── Дүрэм сонгох эрх ──");
  const notOwner = await emit(sb, "queue:setRule", { endRule: "uglug6" });
  check("эзэн биш сольж чадсангүй", notOwner?.error === "not_owner", JSON.stringify(notOwner));

  const badRule = await emit(sa, "queue:setRule", { endRule: "hakker" });
  check("буруу дүрэм татгалзав", badRule?.error === "bad_end_rule");

  const waitRule = waitQueue(sb, (s) => s.endRule === "tsai10");
  const okRule = await emit(sa, "queue:setRule", { endRule: "tsai10" });
  const ruleSeen = await waitRule;
  check("эзэн дүрмээ сольлоо", okRule?.ok === true && okRule.state.endRule === "tsai10");
  check("бусад нь дүрмийг харлаа", ruleSeen?.endRule === "tsai10", JSON.stringify(ruleSeen?.endRule));

  console.log("\n── Гарах ──");
  const waitLeave = waitQueue(sb, (s) => s.size === 1);
  await emit(sa, "queue:leave", {});
  const afterLeave = await waitLeave;
  check("эхний хүн гарлаа", afterLeave?.size === 1, String(afterLeave?.size));
  check("эзэн дараагийнх руу шилжив", afterLeave?.ownerId === b.user.id, JSON.stringify(afterLeave?.ownerId));

  console.log("\n── Салахад автоматаар гарах ──");
  const rc = await emit(sc, "queue:join", {});
  check("гурав дахь хүн орлоо", rc?.state?.size === 2, String(rc?.state?.size));

  const waitDrop = waitQueue(sc, (s) => s.size === 1);
  sb.close();
  const afterDrop = await waitDrop;
  check("салсан хүн дарааллаас гарав", afterDrop?.size === 1, String(afterDrop?.size));
  check("эзэн үлдсэн хүн боллоо", afterDrop?.ownerId === c.user.id);

  // Цэвэрлэгээ
  await emit(sc, "queue:leave", {});
  sa.close();
  sc.close();

  console.log(`\n${passed} тэнцсэн, ${failed} унасан\n`);
  process.exitCode = failed ? 1 : 0;
};

run().catch((err) => {
  console.error("Script алдаа:", err);
  process.exitCode = 1;
});
