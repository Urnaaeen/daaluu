/**
 * UI шалгахад туслах хамтрагч клиент.
 * Дараалалд ЭХЛЭЭД орж owner болно — ингэснээр хөтөч дээрх тоглогч
 * owner БИШ болж, дүрмийн уншигдах хувилбарыг шалгах боломжтой.
 *
 *   node scripts/queue-companion.js [нэр] [секунд]
 */
import { io } from "socket.io-client";

const API = process.env.API_URL ?? "http://localhost:4000";
const name = process.argv[2] ?? "Оюунаа";
const seconds = Number(process.argv[3] ?? 120);

const res = await fetch(`${API}/api/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name,
    email: `mate_${Date.now().toString(36)}@test.mn`,
    password: "nuuts123",
  }),
});
const session = await res.json();
console.log(`👤 ${session.user.name} · ${session.user.playerCode}`);

const socket = io(API, { auth: { token: session.token }, transports: ["websocket"] });

socket.on("queue:update", (s) =>
  console.log(
    `📋 ${s.size}/${s.needed} · дүрэм=${s.endRule} · owner=${
      s.players.find((p) => p.userId === s.ownerId)?.name ?? "—"
    } · [${s.players.map((p) => p.name).join(", ")}]`
  )
);
socket.on("queue:matched", ({ matchId }) => console.log(`🎯 Тоглолт бүрдэв: ${matchId}`));
socket.on("queue:error", (e) => console.log(`⚠️  ${e?.message}`));

socket.on("connect", () => {
  socket.emit("queue:join", {}, (r) => console.log(`➡️  Дараалалд оров: ${r?.ok}`));

  // 10 секундын дараа дүрмээ солино — хөтөч дээр шууд шинэчлэгдэх ёстой
  setTimeout(() => {
    socket.emit("queue:setRule", { endRule: "tsai10" }, (r) =>
      console.log(`🔁 Дүрэм → tsai10: ${JSON.stringify(r?.ok ?? r)}`)
    );
  }, 10_000);
});

setTimeout(() => {
  socket.disconnect();
  console.log("👋 Салав");
  process.exit(0);
}, seconds * 1000);
