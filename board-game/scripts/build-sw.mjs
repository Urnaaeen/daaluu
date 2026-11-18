/**
 * `expo export --platform web`-ийн дараа dist/sw.js үүсгэнэ.
 * Апп-ын бүх файлыг (JS, HTML, зураг, дуу) утсанд хадгалж, интернэтгүй үед
 * тэндээс өгнө — боттой тоглох горим оффлайн ажиллана.
 *
 * API (/api) болон socket.io-г хэзээ ч cache хийхгүй.
 */
import { generateSW } from "workbox-build";

const { count, size, warnings } = await generateSW({
  globDirectory: "dist",
  globPatterns: ["**/*.{html,js,css,json,png,jpg,jpeg,webp,svg,ico,ttf,otf,woff,woff2,mp3,wav,ogg,m4a}"],
  globIgnores: ["sw.js", "workbox-*.js"],
  swDest: "dist/sw.js",
  // Нэг файл хамгийн ихдээ 10MB (дэвсгэр зураг, дуу)
  maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
  // Нэг удаа тааруулдаг "?matchId=…" гэх мэт параметрийг cache-ийн түлхүүрт тооцохгүй
  ignoreURLParametersMatching: [/.*/],
  // Мэдэгдэхгүй хуудас (гүн холбоос) → index.html
  navigateFallback: "/index.html",
  navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
  // Шинэ хувилбар гарвал хуучныг хүлээлгүй шууд сольж, хуучин cache-ийг цэвэрлэнэ
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  // Workbox-ийн runtime-ийг sw.js дотор нь багтаана (нэмэлт файл хэрэггүй)
  inlineWorkboxRuntime: true,
  sourcemap: false,
  mode: "production",
});

for (const w of warnings) console.warn("⚠️", w);
console.log(`✅ sw.js — ${count} файл, ${(size / 1024 / 1024).toFixed(1)}MB оффлайн хадгалагдана`);
