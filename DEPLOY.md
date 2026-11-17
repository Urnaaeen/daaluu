# Цай хураах — байршуулах заавар

Онлайн тоглолт: **өөрийн сервер (Express + Socket.IO + PostgreSQL)**. Firebase хэрэглэхээ больсон.
Сервер аппын вэб хувилбарыг өөрөө үйлчилдэг тул нэг URL хангалттай: найзууд холбоос нээгээд л тоглоно.

## Нэг командоор (Docker байгаа ямар ч VPS / компьютер)

```bash
# .env (daaluu/ дотор)
JWT_SECRET=<урт санамсаргүй мөр>
DB_PASSWORD=<нууц үг>
ALLOW_DEMO_PAYMENTS=true   # QPay холбогдох хүртэл

docker compose up -d --build
# → http://<серверийн IP эсвэл домэйн>:4000
```

HTTPS-ийн хувьд урд нь Caddy/Nginx тавих эсвэл Cloudflare Tunnel ашиглана (websocket дамжуулдаг байх ёстой).

## Cloud (Render / Railway / Fly.io)

1. Repo-г холбож, root дахь `Dockerfile`-ийг сонгоно.
2. Managed Postgres (Neon, Render Postgres…) үүсгээд `DATABASE_URL`-ийг өгнө (SSL автоматаар; шаардлагагүй бол `PGSSL=false`).
3. Орчны хувьсагч: `JWT_SECRET`, `ALLOW_DEMO_PAYMENTS`, `PORT` (платформ өгдөг бол).
4. Асах бүрт migration өөрөө явна.

## Утасны апп (Expo / EAS build)

`board-game/.env`-д `EXPO_PUBLIC_API_URL=https://<таны домэйн>` гэж тавиад build хийнэ.
Вэб build (`npm run export:web`) нь `.env.production`-ийн `same-origin` утгаар хуудас нээгдсэн хаягаа ашиглана.

## Шалгах

```bash
cd server
npm run smoke:friends   # кодоор нэгдэх → урилга → ширээнд суух (22 шалгалт)
```
