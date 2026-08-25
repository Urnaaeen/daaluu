/**
 * API-ийн бүрэн урсгалыг шалгах script.
 *   node scripts/smoke.js
 *
 * Shell-ийн кодчилолоос хамаарахгүй тул монгол нэр зөв дамжина.
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
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
};

const run = async () => {
  // Дахин ажиллуулах бүрт шинэ хэрэглэгч
  const email = `smoke_${Date.now().toString(36)}@test.mn`;
  const name = "Тэмүүлэн";
  const password = "nuuts123";

  console.log("\n── Бүртгэл ──");
  const reg = await call("POST", "/auth/register", { body: { name, email, password } });
  check("бүртгүүлэв", reg.status === 201, JSON.stringify(reg.json));
  check("монгол нэр зөв хадгалагдав", reg.json.user?.name === name, `→ ${reg.json.user?.name}`);
  check("player_code үүсэв", /^daaluu#\d{4}$/.test(reg.json.user?.playerCode ?? ""), reg.json.user?.playerCode);
  check("шинэ хэрэглэгч 0 зоостой", reg.json.user?.coins === 0, String(reg.json.user?.coins));

  const token = reg.json.token;

  const dup = await call("POST", "/auth/register", { body: { name, email, password } });
  check("ижил и-мэйл татгалзав", dup.json.error === "email_taken");

  const weak = await call("POST", "/auth/register", {
    body: { name, email: `x${email}`, password: "123" },
  });
  check("богино нууц үг татгалзав", weak.json.error === "weak_password");

  console.log("\n── Нэвтрэлт ──");
  const bad = await call("POST", "/auth/login", { body: { email, password: "buruu" } });
  check("буруу нууц үг татгалзав", bad.json.error === "bad_credentials");

  const login = await call("POST", "/auth/login", { body: { email, password } });
  check("зөв нэвтэрлээ", login.status === 200 && !!login.json.token);

  const noAuth = await call("GET", "/auth/me");
  check("токенгүй хандалт хаагдав", noAuth.json.error === "no_token");

  const me = await call("GET", "/auth/me", { token });
  check("/me ажиллав", me.json.user?.email === email);
  check("статистик 0-ээс эхлэв", me.json.stats?.plays === 0 || me.json.stats?.plays === "0");

  console.log("\n── Зоос хүрэлцэхгүй ──");
  const poor = await call("POST", "/rooms", { token, body: { name: "Эхний өрөө" } });
  check("зоосгүйгээр өрөө авч чадсангүй", poor.json.error === "insufficient_coins", JSON.stringify(poor.json));

  console.log("\n── Цэнэглэлт (QPay mock) ──");
  const packs = await call("GET", "/coins/packs");
  check("багцууд ирлээ", packs.json.packs?.length === 4);

  const badPack = await call("POST", "/coins/invoice", { token, body: { packId: "hakker" } });
  check("байхгүй багц татгалзав", badPack.json.error === "bad_pack");

  const inv = await call("POST", "/coins/invoice", { token, body: { packId: "p120" } });
  check("нэхэмжлэх үүслээ", inv.status === 201, JSON.stringify(inv.json));
  check("QR текст ирлээ", (inv.json.payment?.qr_text ?? "").length > 20);
  check("банкны deeplink ирлээ", (inv.json.payment?.bank_urls ?? []).length >= 10);
  check(
    "deeplink зөв хэлбэртэй",
    /^khanbank:\/\/q\?qPay_QRcode=/.test(inv.json.payment?.bank_urls?.[0]?.link ?? ""),
    inv.json.payment?.bank_urls?.[0]?.link?.slice(0, 40)
  );
  check("үнэ серверээс тогтов", inv.json.payment?.price_mnt === 2000, String(inv.json.payment?.price_mnt));

  const paymentId = inv.json.payment?.id;

  const pay = await call("POST", `/coins/invoice/${paymentId}/demo-pay`, { token });
  check("төлбөр амжилттай", pay.json.ok === true, JSON.stringify(pay.json));
  check("зоос 120 боллоо", pay.json.coins === 120, String(pay.json.coins));

  const again = await call("POST", `/coins/invoice/${paymentId}/demo-pay`, { token });
  check("давхар төлөлт зоос нэмсэнгүй", again.json.alreadyPaid === true && again.json.coins === 120);

  const bal = await call("GET", "/coins/balance", { token });
  check("үлдэгдэл 120", bal.json.coins === 120);
  check("ledger бичигдэв", bal.json.ledger?.[0]?.kind === "purchase" && bal.json.ledger?.[0]?.amount === 120);

  console.log("\n── Өрөө худалдаж авах ──");
  const room = await call("POST", "/rooms", { token, body: { name: "Найзуудын өрөө" } });
  check("өрөө үүслээ", room.status === 201, JSON.stringify(room.json));
  check("нэр монголоор", room.json.room?.name === "Найзуудын өрөө", room.json.room?.name);
  check("4 оронтой код", /^\d{4}$/.test(room.json.room?.code ?? ""), room.json.room?.code);
  check("зоос 70 болж хасагдав", room.json.coins === 70, String(room.json.coins));

  const roomId = room.json.room?.id;

  const list = await call("GET", "/rooms", { token });
  check("өрөө жагсаалтад орлоо", list.json.rooms?.length === 1);

  console.log("\n── Урих ──");
  const selfInvite = await call("POST", `/rooms/${roomId}/invite`, {
    token,
    body: { playerCode: reg.json.user.playerCode },
  });
  check("өөрийгөө урьж чадсангүй", selfInvite.json.error === "self_invite");

  const ghost = await call("POST", `/rooms/${roomId}/invite`, {
    token,
    body: { playerCode: "daaluu#0000" },
  });
  check("байхгүй тоглогч татгалзав", ghost.json.error === "player_not_found");

  // Урих хоёр дахь хэрэглэгч
  const friendEmail = `friend_${Date.now().toString(36)}@test.mn`;
  const friend = await call("POST", "/auth/register", {
    body: { name: "Хандцоож", email: friendEmail, password },
  });

  const invite = await call("POST", `/rooms/${roomId}/invite`, {
    token,
    body: { playerCode: friend.json.user.playerCode },
  });
  check("найзыг урилаа", invite.status === 201, JSON.stringify(invite.json));

  const dupInvite = await call("POST", `/rooms/${roomId}/invite`, {
    token,
    body: { playerCode: friend.json.user.playerCode },
  });
  check("давхар урилга татгалзав", dupInvite.json.error === "already_invited");

  const members = await call("GET", `/rooms/${roomId}/members`, { token });
  check("гишүүн жагсаалтад орлоо", members.json.members?.[0]?.name === "Хандцоож");

  console.log("\n── Хамгаалалт ──");
  const otherRoom = await call("GET", `/rooms/${roomId}/members`, { token: friend.json.token });
  check("бусдын өрөө харагдахгүй", otherRoom.json.error === "room_not_found");

  const noSecret = await call("POST", "/coins/callback", { body: { payment_id: paymentId } });
  check("нууц түлхүүргүй callback хаагдав", noSecret.json.error === "bad_callback_secret");

  console.log(`\n${passed} тэнцсэн, ${failed} унасан\n`);
  process.exitCode = failed ? 1 : 0;
};

run().catch((err) => {
  console.error("Script алдаа:", err.message);
  process.exitCode = 1;
});
