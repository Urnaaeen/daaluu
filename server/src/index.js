import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { closePool, pool } from "./db.js";
import { loadTileTypes } from "./game/tiles.js";
import authRouter from "./routes/auth.js";
import coinsRouter from "./routes/coins.js";
import healthRouter from "./routes/health.js";
import matchesRouter from "./routes/matches.js";
import roomsRouter from "./routes/rooms.js";
import { attachRealtime, startTurnTimer } from "./realtime.js";

const app = express();

app.use(express.json());
app.use(
  cors({
    // CORS_ORIGIN хоосон бол хөгжүүлэлтийн үед бүгдийг зөвшөөрнө
    origin: config.corsOrigins.length ? config.corsOrigins : true,
    credentials: true,
  })
);

app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/coins", coinsRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/matches", matchesRouter);

// Тодорхойгүй зам
app.use((req, res) => {
  res.status(404).json({ error: "not_found", path: req.path });
});

// Алдааны нэгдсэн боловсруулалт — дотоод мэдээллийг клиент рүү гаргахгүй
app.use((err, req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error("❌", req.method, req.path, err);

  res.status(status).json({
    error: err.code ?? "internal_error",
    // Хэрэглэгчид харуулах монгол текст (зөвхөн бидний зориудаар өгсөн үед)
    message: err.userMessage ?? "Алдаа гарлаа. Дахин оролдоно уу.",
  });
});

const server = app.listen(config.port, () => {
  console.log(`🚀 Даалуу API — http://localhost:${config.port}`);
  console.log(`🐘 Postgres — ${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}`);
});

attachRealtime(server);
startTurnTimer();
console.log("🔌 Realtime (socket.io) болон ээлжийн таймер идэвхтэй");

const shutdown = async (signal) => {
  console.log(`\n${signal} — зогсоож байна…`);
  server.close();
  await closePool().catch(() => {});
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Асахдаа DB-тэй холбогдож, модны лавлахыг санах ойд ачаална
pool
  .query("select 1")
  .then(() => loadTileTypes())
  .then((n) => console.log(`✅ Postgres бэлэн · ${n} төрлийн мод ачаалав`))
  .catch((err) => console.error("❌ Postgres холбогдсонгүй:", err.message));
